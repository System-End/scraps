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
	banned?: boolean
	suspected?: boolean
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
// Cache of hackatime user_id -> hackatime user
const hackatimeUserIdCache = new Map<number, HackatimeUser>()

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

		const info = await infoResponse.json() as { user: { user_id: number; username: string; slack_uid: string | null; banned: boolean; suspected: boolean } }
		const user: HackatimeUser = {
			user_id: info.user.user_id,
			username: info.user.username,
			slack_uid: info.user.slack_uid || undefined,
			banned: info.user.banned || false,
			suspected: info.user.suspected || false
		}
		hackatimeUserCache.set(email, user)
		return user
	} catch {
		return null
	}
}

export async function getHackatimeUserById(userId: number): Promise<HackatimeUser | null> {
	const cached = hackatimeUserIdCache.get(userId)
	if (cached !== undefined) return cached

	try {
		const infoResponse = await fetch(`${HACKATIME_API}/user/info?user_id=${userId}`, {
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Accept': 'application/json'
			}
		})
		if (!infoResponse.ok) return null

		const info = await infoResponse.json() as { user: { user_id: number; username: string; slack_uid: string | null; banned: boolean; suspected: boolean } }
		const user: HackatimeUser = {
			user_id: info.user.user_id,
			username: info.user.username,
			slack_uid: info.user.slack_uid || undefined,
			banned: info.user.banned || false,
			suspected: info.user.suspected || false
		}
		hackatimeUserIdCache.set(userId, user)
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

interface ParsedHackatimeEntry {
	slackId: string | null
	hackatimeUserId: number | null
	projectName: string
}

function parseHackatimeEntry(entry: string): ParsedHackatimeEntry | null {
	if (!entry) return null

	// New format: "123:projectName" (numeric hackatime user ID with colon)
	const colonIndex = entry.indexOf(':')
	if (colonIndex !== -1 && !entry.startsWith('U')) {
		const idStr = entry.substring(0, colonIndex)
		const id = parseInt(idStr, 10)
		if (!isNaN(id)) {
			return {
				slackId: null,
				hackatimeUserId: id,
				projectName: entry.substring(colonIndex + 1)
			}
		}
	}

	// Old format: "U12345/projectName" (Slack ID with slash)
	const slashIndex = entry.indexOf('/')
	if (slashIndex !== -1 && entry.startsWith('U')) {
		return {
			slackId: entry.substring(0, slashIndex),
			hackatimeUserId: null,
			projectName: entry.substring(slashIndex + 1)
		}
	}

	// Plain project name (no prefix)
	return {
		slackId: null,
		hackatimeUserId: null,
		projectName: entry
	}
}

function parseHackatimeProjects(hackatimeProject: string | null): ParsedHackatimeEntry[] {
	if (!hackatimeProject) return []
	return hackatimeProject
		.split(',')
		.map(p => p.trim())
		.filter(p => p.length > 0)
		.map(p => parseHackatimeEntry(p))
		.filter((p): p is ParsedHackatimeEntry => p !== null && p.projectName.length > 0)
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

		// Cache of identifier -> projects data to avoid refetching
		const projectsCache = new Map<string, { name: string; total_duration: number }[]>()

		async function getProjectsForIdentifier(ident: string): Promise<{ name: string; total_duration: number }[] | null> {
			if (projectsCache.has(ident)) return projectsCache.get(ident)!
			const data = await fetchUserProjects(ident)
			if (data) projectsCache.set(ident, data)
			return data
		}

		for (const [email, userProjects] of projectsByEmail) {
			// Look up hackatime user by email (may fail for some users)
			const hackatimeUser = await getHackatimeUser(email)
			const emailIdentifier = hackatimeUser ? (hackatimeUser.slack_uid || hackatimeUser.username) : null

			// Match each scraps project to its hackatime project(s)
			for (const project of userProjects) {
				const entries = parseHackatimeProjects(project.hackatimeProject)
				if (entries.length === 0) continue

				let totalSeconds = 0
				let needsMigration = false
				const migratedEntries: string[] = []

				// Group entries by resolved identifier to batch lookups
				const entriesByIdentifier = new Map<string, string[]>()
				for (const entry of entries) {
					let key: string | null = null
					let resolvedHackatimeUserId: number | null = entry.hackatimeUserId

					if (entry.hackatimeUserId) {
						// Already new format
						const htUser = await getHackatimeUserById(entry.hackatimeUserId)
						key = htUser ? (htUser.slack_uid || htUser.username) : emailIdentifier
						migratedEntries.push(`${entry.hackatimeUserId}:${entry.projectName}`)
					} else {
						// Old format (slackId/ or plain name) - needs migration
						needsMigration = true

						if (entry.slackId) {
							key = entry.slackId
						} else {
							key = emailIdentifier
						}

						// Try to resolve hackatime user ID for migration
						if (hackatimeUser) {
							resolvedHackatimeUserId = hackatimeUser.user_id
						}

						if (resolvedHackatimeUserId) {
							migratedEntries.push(`${resolvedHackatimeUserId}:${entry.projectName}`)
						} else {
							// Can't resolve, keep as-is
							migratedEntries.push(entry.projectName)
						}
					}

					if (!key) continue

					const existing = entriesByIdentifier.get(key) || []
					existing.push(entry.projectName)
					entriesByIdentifier.set(key, existing)
				}

				for (const [entryIdentifier, projectNames] of entriesByIdentifier) {
					const projectsData = await getProjectsForIdentifier(entryIdentifier)

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
				const newHackatimeProject = migratedEntries.join(',')

				// Update if hours changed or hackatimeProject format needs migration
				if (hours !== project.hours || (needsMigration && newHackatimeProject !== project.hackatimeProject)) {
					const updates: { hours: number; updatedAt: Date; hackatimeProject?: string } = { hours, updatedAt: new Date() }
					if (needsMigration && newHackatimeProject !== project.hackatimeProject) {
						updates.hackatimeProject = newHackatimeProject
						console.log(`[HACKATIME-SYNC] Migrated project ${project.id}: "${project.hackatimeProject}" -> "${newHackatimeProject}"`)
					}
					await db
						.update(projectsTable)
						.set(updates)
						.where(eq(projectsTable.id, project.id))
					updated++
				}
			}
		}

		const elapsed = Date.now() - startTime
		console.log(`[HACKATIME-SYNC] Completed: ${projects.length} projects, ${updated} updated, ${elapsed}ms`)

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
