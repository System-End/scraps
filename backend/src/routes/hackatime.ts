import { Elysia } from 'elysia'
import { getUserFromSession } from '../lib/auth'

const HACKATIME_API = 'https://hackatime.hackclub.com/api/v1'
const SCRAPS_START_DATE = '2026-02-03'

interface HackatimeStatsProject {
	name: string
	total_seconds: number
}

interface HackatimeDetailsProject {
	name: string
	total_seconds: number
	languages: string[]
	repo_url: string | null
}

interface HackatimeStatsResponse {
	data: {
		projects: HackatimeStatsProject[]
	}
}

interface HackatimeDetailsResponse {
	projects: HackatimeDetailsProject[]
}

const hackatime = new Elysia({ prefix: '/hackatime' })

hackatime.get('/projects', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) return { error: 'Unauthorized' }

	if (!user.slackId) {
		console.log('[HACKATIME] No slackId found for user:', user.id)
		return { error: 'No Slack ID found for user', projects: [] }
	}

	const statsParams = new URLSearchParams({
		features: 'projects',
		start_date: SCRAPS_START_DATE
	})
	const statsUrl = `${HACKATIME_API}/users/${encodeURIComponent(user.slackId)}/stats?${statsParams}`
	const detailsUrl = `${HACKATIME_API}/users/${encodeURIComponent(user.slackId)}/projects/details`
	console.log('[HACKATIME] Fetching projects:', { userId: user.id, slackId: user.slackId, statsUrl })

	try {
		// Fetch both stats (for hours after start date) and details (for repo URLs and languages)
		const [statsResponse, detailsResponse] = await Promise.all([
			fetch(statsUrl, { headers: { 'Accept': 'application/json' } }),
			fetch(detailsUrl, { headers: { 'Accept': 'application/json' } })
		])

		if (!statsResponse.ok) {
			const errorText = await statsResponse.text()
			console.log('[HACKATIME] Stats API error:', { status: statsResponse.status, body: errorText })
			return { projects: [] }
		}

		const statsData: HackatimeStatsResponse = await statsResponse.json()
		const detailsData: HackatimeDetailsResponse = detailsResponse.ok 
			? await detailsResponse.json() 
			: { projects: [] }

		const projects = statsData.data?.projects || []
		console.log('[HACKATIME] Projects fetched:', projects.length)

		// Create a map of project details for quick lookup
		const detailsMap = new Map(
			detailsData.projects?.map(p => [p.name, p]) || []
		)

		return {
			slackId: user.slackId,
			projects: projects.map((p) => {
				const details = detailsMap.get(p.name)
				return {
					name: p.name,
					hours: Math.round(p.total_seconds / 3600 * 10) / 10,
					repoUrl: details?.repo_url || null,
					languages: details?.languages || []
				}
			})
		}
	} catch (error) {
		console.error('[HACKATIME] Error fetching projects:', error)
		return { projects: [] }
	}
})

export default hackatime
