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

interface HackatimeUserProjectsResponse {
	user_id: number
	username: string
	total_projects: number
	projects: HackatimeAdminProject[]
}

// Cache of email -> hackatime user ID to avoid repeated lookups
const hackatimeUserIdCache = new Map<string, number>()

async function getHackatimeUserId(email: string): Promise<number | null> {
	const cached = hackatimeUserIdCache.get(email)
	if (cached !== undefined) return cached

	try {
		const response = await fetch(`${HACKATIME_API}/user/get_user_by_email`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ email })
		})
		if (!response.ok) return null

		const data = await response.json() as { user_id: number }
		hackatimeUserIdCache.set(email, data.user_id)
		return data.user_id
	} catch {
		return null
	}
}

async function fetchUserProjects(hackatimeUserId: number): Promise<HackatimeAdminProject[] | null> {
	try {
		const params = new URLSearchParams({ user_id: String(hackatimeUserId), start_date: SCRAPS_START_DATE })
		const response = await fetch(`${HACKATIME_API}/user/projects?${params}`, {
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Accept': 'application/json'
			}
		})
		if (!response.ok) return null

		const data: HackatimeUserProjectsResponse = await response.json()
		return data.projects || []
	} catch {
		return null
	}
}

function parseHackatimeProject(hackatimeProject: string | null): { slackId: string; projectName: string } | null {
	if (!hackatimeProject) return null
	const slashIndex = hackatimeProject.indexOf('/')
	if (slashIndex === -1) return null
	return {
		slackId: hackatimeProject.substring(0, slashIndex),
		projectName: hackatimeProject.substring(slashIndex + 1)
	}
}

async function syncAllProjects(): Promise<void> {
	console.log('[HACKATIME-SYNC] Starting sync...')
	const startTime = Date.now()

	try {
		// Get all projects with hackatime projects that are not deleted, joined with user email
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
				or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted))
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
			// Look up hackatime user ID by email
			const hackatimeUserId = await getHackatimeUserId(email)
			if (hackatimeUserId === null) {
				errors += userProjects.length
				continue
			}

			// Fetch all projects for this user from the admin API
			const adminProjects = await fetchUserProjects(hackatimeUserId)
			if (adminProjects === null) {
				errors += userProjects.length
				continue
			}

			// Build a map of project name -> total_duration for quick lookup
			const adminProjectMap = new Map<string, number>()
			for (const ap of adminProjects) {
				adminProjectMap.set(ap.name, ap.total_duration)
			}

			// Match each scraps project to its hackatime project
			for (const project of userProjects) {
				const parsed = parseHackatimeProject(project.hackatimeProject)
				if (!parsed) continue

				const totalDuration = adminProjectMap.get(parsed.projectName)
				const hours = totalDuration !== undefined
					? Math.round(totalDuration / 3600 * 10) / 10
					: 0

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

		const parsed = parseHackatimeProject(project.hackatimeProject)
		if (!parsed) return { hours: project.hours ?? 0, updated: false, error: 'Invalid Hackatime project format' }

		const hackatimeUserId = await getHackatimeUserId(project.userEmail)
		if (hackatimeUserId === null) return { hours: project.hours ?? 0, updated: false, error: 'Could not find Hackatime user' }

		const adminProjects = await fetchUserProjects(hackatimeUserId)
		if (adminProjects === null) return { hours: project.hours ?? 0, updated: false, error: 'Failed to fetch Hackatime projects' }

		const hackatimeProject = adminProjects.find(p => p.name === parsed.projectName)
		const hours = hackatimeProject
			? Math.round(hackatimeProject.total_duration / 3600 * 10) / 10
			: 0

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
