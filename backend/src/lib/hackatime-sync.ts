import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { usersTable } from '../schemas/users'
import { userActivityTable } from '../schemas/user-emails'
import { isNotNull, and, or, eq, isNull, sql, sum } from 'drizzle-orm'
import { config } from '../config'

const HACKATIME_API = 'https://hackatime.hackclub.com/api/admin/v1'
const SCRAPS_START_DATE = '2026-02-03'
const SYNC_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

interface HackatimeAdminProject {
	name: string
	total_heartbeats: number
	total_duration: number
	first_heartbeat: number
	last_heartbeat: number
	languages: string[]
	repo: string
	repo_mapping_id: number
	archived: boolean
}

interface HackatimeUser {
	user_id: number
	username: string
	slack_uid?: string
}

interface HackatimeStatsProject {
	name: string
	total_seconds: number
}

interface HackatimeStatsResponse {
	data: {
		projects: HackatimeStatsProject[]
	}
}

// Cache of email -> hackatime user to avoid repeated lookups
const hackatimeUserCache = new Map<string, HackatimeUser>()

export async function getHackatimeUser(email: string): Promise<HackatimeUser | null> {
	const cached = hackatimeUserCache.get(email)
	if (cached !== undefined) return cached

	try {
		// First get user_id by email
		const emailResponse = await fetch(`${HACKATIME_API}/user/get_user_by_email`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ email })
		})
		if (!emailResponse.ok) return null

		const { user_id } = await emailResponse.json() as { user_id: number }

		// Then get username and slack_uid by user_id
		const infoResponse = await fetch(`${HACKATIME_API}/user/info?user_id=${user_id}`, {
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Accept': 'application/json'
			}
		})
		if (!infoResponse.ok) return null

		const info = await infoResponse.json() as { user: { user_id: number; username: string; slack_uid: string | null } }
		const user: HackatimeUser = {
			user_id: info.user.user_id,
			username: info.user.username,
			slack_uid: info.user.slack_uid || undefined
		}
		hackatimeUserCache.set(email, user)
		return user
	} catch {
		return null
	}
}

async function fetchUserProjects(username: string): Promise<{ name: string; total_duration: number }[] | null> {
	try {
		const params = new URLSearchParams({ 
			features: 'projects',
			start_date: SCRAPS_START_DATE 
		})
		const response = await fetch(`https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(username)}/stats?${params}`, {
			headers: {
				'Accept': 'application/json'
			}
		})
		if (!response.ok) return null

		const data: HackatimeStatsResponse = await response.json()
		// Convert total_seconds to total_duration for compatibility with existing code
		return (data.data?.projects || []).map(p => ({
			name: p.name,
			total_duration: p.total_seconds
		}))
	} catch {
		return null
	}
}

function parseHackatimeProject(hackatimeProject: string | null): string | null {
	if (!hackatimeProject) return null
	const slashIndex = hackatimeProject.indexOf('/')
	if (slashIndex === -1) return hackatimeProject
	return hackatimeProject.substring(slashIndex + 1)
}

function parseHackatimeProjectSlackId(hackatimeProject: string | null): string | null {
	if (!hackatimeProject) return null
	const slashIndex = hackatimeProject.indexOf('/')
	if (slashIndex === -1) return null
	return hackatimeProject.substring(0, slashIndex)
}

interface ParsedHackatimeEntry {
	slackId: string | null
	projectName: string
}

function parseHackatimeProjects(hackatimeProject: string | null): ParsedHackatimeEntry[] {
	if (!hackatimeProject) return []
	return hackatimeProject
		.split(',')
		.map(p => p.trim())
		.filter(p => p.length > 0)
		.map(p => ({
			slackId: parseHackatimeProjectSlackId(p),
			projectName: parseHackatimeProject(p)!
		}))
		.filter(p => p.projectName !== null)
}

async function syncAllProjects(): Promise<void> {
	console.log('[HACKATIME-SYNC] Starting sync...')
	const startTime = Date.now()

	try {
		// Get all projects with hackatime projects that are not deleted and not shipped, joined with user email
		const projects = await db
			.select({
				id: projectsTable.id,
				hackatimeProject: projectsTable.hackatimeProject,
				hours: projectsTable.hours,
				userId: projectsTable.userId,
				userEmail: usersTable.email
			})
			.from(projectsTable)
			.innerJoin(usersTable, eq(projectsTable.userId, usersTable.id))
			.where(and(
				isNotNull(projectsTable.hackatimeProject),
				or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted)),
				sql`${projectsTable.status} != 'shipped'`
			))

		// Group projects by user email to batch API calls
		const projectsByEmail = new Map<string, typeof projects>()
		for (const project of projects) {
			const existing = projectsByEmail.get(project.userEmail) || []
			existing.push(project)
			projectsByEmail.set(project.userEmail, existing)
		}

		let updated = 0
		let errors = 0

		for (const [email, userProjects] of projectsByEmail) {
			// Look up hackatime user by email
			const hackatimeUser = await getHackatimeUser(email)
			if (hackatimeUser === null) {
				errors += userProjects.length
				continue
			}

			// Fetch all projects for this user from the stats API with date filtering
			const identifier = hackatimeUser.slack_uid || hackatimeUser.username
			const adminProjects = await fetchUserProjects(identifier)
			if (adminProjects === null) {
				errors += userProjects.length
				continue
			}

			// Build a map of project name -> total_duration for quick lookup
			const adminProjectMap = new Map<string, number>()
			for (const ap of adminProjects) {
				adminProjectMap.set(ap.name, ap.total_duration)
			}

			// Match each scraps project to its hackatime project(s)
			for (const project of userProjects) {
				const entries = parseHackatimeProjects(project.hackatimeProject)
				if (entries.length === 0) continue

				let totalSeconds = 0

				// Group entries by slackId to batch lookups for different users
				const entriesBySlackId = new Map<string, string[]>()
				for (const entry of entries) {
					const key = entry.slackId || identifier
					const existing = entriesBySlackId.get(key) || []
					existing.push(entry.projectName)
					entriesBySlackId.set(key, existing)
				}

				for (const [entryIdentifier, projectNames] of entriesBySlackId) {
					let projectsData: { name: string; total_duration: number }[] | null

					if (entryIdentifier === identifier) {
						// Same user, reuse already-fetched data
						projectsData = adminProjects
					} else {
						// Different user (slackId prefix), fetch their projects
						projectsData = await fetchUserProjects(entryIdentifier)
					}

					if (projectsData) {
						for (const name of projectNames) {
							const found = projectsData.find(p => p.name === name)
							if (found) {
								totalSeconds += found.total_duration
							}
						}
					}
				}

				const hours = Math.round(totalSeconds / 3600 * 10) / 10

				// Only update if hours changed
				if (hours !== project.hours) {
					await db
						.update(projectsTable)
						.set({ hours, updatedAt: new Date() })
						.where(eq(projectsTable.id, project.id))
					updated++
				}
			}
		}

		const elapsed = Date.now() - startTime
		console.log(`[HACKATIME-SYNC] Completed: ${projects.length} projects, ${updated} updated, ${errors} errors, ${elapsed}ms`)

		// Check hour milestones for all users
		await checkHourMilestones()
	} catch (error) {
		console.error('[HACKATIME-SYNC] Error:', error)
	}
}

const HOUR_MILESTONES = [
	{ hours: 1, action: 'scrapsOneHour' },
	{ hours: 5, action: 'scrapsFiveHours' },
	{ hours: 10, action: 'scrapsTenHours' },
	{ hours: 20, action: 'scrapsTwentyHours' }
] as const

async function checkHourMilestones(): Promise<void> {
	try {
		// Get total hours per user across all non-deleted projects
		const userHours = await db
			.select({
				userId: projectsTable.userId,
				totalHours: sql<number>`COALESCE(SUM(COALESCE(${projectsTable.hoursOverride}, ${projectsTable.hours})), 0)`.as('total_hours')
			})
			.from(projectsTable)
			.where(or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted)))
			.groupBy(projectsTable.userId)

		for (const { userId, totalHours } of userHours) {
			console.log(`[HACKATIME-SYNC] User ${userId}: ${totalHours} total hours (type: ${typeof totalHours})`)
		}

		// Get existing milestone activities for all users
		const existingMilestones = await db
			.select({
				userId: userActivityTable.userId,
				action: userActivityTable.action
			})
			.from(userActivityTable)
			.where(sql`${userActivityTable.action} IN ('scrapsOneHour', 'scrapsFiveHours', 'scrapsTenHours', 'scrapsTwentyHours')`)

		const existingSet = new Set(
			existingMilestones
				.filter(m => m.userId != null)
				.map(m => `${m.userId}:${m.action}`)
		)

		// Get emails for users we might need to insert for
		const userIds = userHours.map(u => u.userId)
		let userEmails: Map<number, string> = new Map()
		if (userIds.length > 0) {
			const users = await db
				.select({ id: usersTable.id, email: usersTable.email })
				.from(usersTable)
				.where(sql`${usersTable.id} IN ${userIds}`)
			userEmails = new Map(users.map(u => [u.id, u.email]))
		}

		let milestonesLogged = 0

		for (const { userId, totalHours } of userHours) {
			const hours = Number(totalHours) || 0
			for (const milestone of HOUR_MILESTONES) {
				if (hours >= milestone.hours && !existingSet.has(`${userId}:${milestone.action}`)) {
					await db.insert(userActivityTable).values({
						userId,
						email: userEmails.get(userId) || '',
						action: milestone.action
					})
					milestonesLogged++
				}
			}
		}

		if (milestonesLogged > 0) {
			console.log(`[HACKATIME-SYNC] Logged ${milestonesLogged} new hour milestones`)
		}
	} catch (error) {
		console.error('[HACKATIME-SYNC] Error checking hour milestones:', error)
	}
}

let syncInterval: ReturnType<typeof setInterval> | null = null

export async function syncSingleProject(projectId: number): Promise<{ hours: number; updated: boolean; error?: string }> {
	try {
		const [project] = await db
			.select({
				id: projectsTable.id,
				hackatimeProject: projectsTable.hackatimeProject,
				hours: projectsTable.hours,
				userEmail: usersTable.email
			})
			.from(projectsTable)
			.innerJoin(usersTable, eq(projectsTable.userId, usersTable.id))
			.where(eq(projectsTable.id, projectId))
			.limit(1)

		if (!project) return { hours: 0, updated: false, error: 'Project not found' }
		if (!project.hackatimeProject) return { hours: project.hours ?? 0, updated: false, error: 'No Hackatime project linked' }

		const entries = parseHackatimeProjects(project.hackatimeProject)
		if (entries.length === 0) return { hours: project.hours ?? 0, updated: false, error: 'Invalid Hackatime project format' }

		const hackatimeUser = await getHackatimeUser(project.userEmail)
		if (hackatimeUser === null) return { hours: project.hours ?? 0, updated: false, error: 'Could not find Hackatime user' }

		const identifier = hackatimeUser.slack_uid || hackatimeUser.username

		let totalSeconds = 0

		// Group entries by slackId to batch lookups for different users
		const entriesBySlackId = new Map<string, string[]>()
		for (const entry of entries) {
			const key = entry.slackId || identifier
			const existing = entriesBySlackId.get(key) || []
			existing.push(entry.projectName)
			entriesBySlackId.set(key, existing)
		}

		for (const [entryIdentifier, projectNames] of entriesBySlackId) {
			const projectsData = await fetchUserProjects(entryIdentifier)
			if (projectsData === null) continue

			for (const name of projectNames) {
				const hackatimeProject = projectsData.find(p => p.name === name)
				if (hackatimeProject) {
					totalSeconds += hackatimeProject.total_duration
				}
			}
		}

		const hours = Math.round(totalSeconds / 3600 * 10) / 10

		if (hours !== project.hours) {
			await db
				.update(projectsTable)
				.set({ hours, updatedAt: new Date() })
				.where(eq(projectsTable.id, projectId))
			console.log(`[HACKATIME-SYNC] Manual sync project ${projectId}: ${project.hours}h -> ${hours}h`)
			return { hours, updated: true }
		}

		return { hours, updated: false }
	} catch (error) {
		console.error(`[HACKATIME-SYNC] Error syncing project ${projectId}:`, error)
		return { hours: 0, updated: false, error: 'Sync failed' }
	}
}

export function startHackatimeSync(): void {
	if (syncInterval) return

	console.log('[HACKATIME-SYNC] Starting background sync (every 2 minutes)')

	// Run immediately on start
	syncAllProjects()

	// Then run every 2 minutes
	syncInterval = setInterval(syncAllProjects, SYNC_INTERVAL_MS)
}

export function stopHackatimeSync(): void {
	if (syncInterval) {
		clearInterval(syncInterval)
		syncInterval = null
		console.log('[HACKATIME-SYNC] Stopped background sync')
	}
}
