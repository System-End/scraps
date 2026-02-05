import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { isNotNull, and, or, eq, isNull } from 'drizzle-orm'

const HACKATIME_API = 'https://hackatime.hackclub.com/api/v1'
const SCRAPS_START_DATE = '2026-02-03'
const SYNC_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes

interface HackatimeStatsProject {
	name: string
	total_seconds: number
}

interface HackatimeStatsResponse {
	data: {
		projects: HackatimeStatsProject[]
	}
}

async function fetchHackatimeHours(slackId: string, projectName: string): Promise<number> {
	try {
		const params = new URLSearchParams({
			features: 'projects',
			start_date: SCRAPS_START_DATE,
			filter_by_project: projectName
		})
		const url = `${HACKATIME_API}/users/${encodeURIComponent(slackId)}/stats?${params}`
		const response = await fetch(url, {
			headers: { 'Accept': 'application/json' }
		})
		if (!response.ok) return -1

		const data: HackatimeStatsResponse = await response.json()
		const project = data.data?.projects?.find(p => p.name === projectName)
		if (!project) return 0

		return Math.round(project.total_seconds / 3600 * 10) / 10
	} catch {
		return -1
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
		// Get all projects with hackatime projects that are not deleted
		const projects = await db
			.select({
				id: projectsTable.id,
				hackatimeProject: projectsTable.hackatimeProject,
				hours: projectsTable.hours
			})
			.from(projectsTable)
			.where(and(
				isNotNull(projectsTable.hackatimeProject),
				or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted))
			))

		let updated = 0
		let errors = 0

		for (const project of projects) {
			const parsed = parseHackatimeProject(project.hackatimeProject)
			if (!parsed) continue

			const hours = await fetchHackatimeHours(parsed.slackId, parsed.projectName)
			if (hours < 0) {
				errors++
				continue
			}

			// Only update if hours changed
			if (hours !== project.hours) {
				await db
					.update(projectsTable)
					.set({ hours, updatedAt: new Date() })
					.where(eq(projectsTable.id, project.id))
				updated++
			}
		}

		const elapsed = Date.now() - startTime
		console.log(`[HACKATIME-SYNC] Completed: ${projects.length} projects, ${updated} updated, ${errors} errors, ${elapsed}ms`)
	} catch (error) {
		console.error('[HACKATIME-SYNC] Error:', error)
	}
}

let syncInterval: ReturnType<typeof setInterval> | null = null

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
