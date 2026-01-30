import { Elysia } from 'elysia'
import { getUserFromSession } from '../lib/auth'

const HACKATIME_API = 'https://hackatime.hackclub.com/api/v1'

interface HackatimeProject {
	name: string
	total_seconds: number
	languages: string[]
	repo_url: string | null
	total_heartbeats: number
	first_heartbeat: string
	last_heartbeat: string
}

interface HackatimeResponse {
	projects: HackatimeProject[]
}

const hackatime = new Elysia({ prefix: '/hackatime' })

hackatime.get('/projects', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) return { error: 'Unauthorized' }

	if (!user.slackId) {
		console.log('[HACKATIME] No slackId found for user:', user.id)
		return { error: 'No Slack ID found for user', projects: [] }
	}

	const url = `${HACKATIME_API}/users/${encodeURIComponent(user.slackId)}/projects/details`
	console.log('[HACKATIME] Fetching projects:', { userId: user.id, slackId: user.slackId, url })

	try {
		const response = await fetch(url, {
			headers: {
				'Accept': 'application/json'
			}
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.log('[HACKATIME] API error:', { status: response.status, body: errorText })
			return { projects: [] }
		}

		const data: HackatimeResponse = await response.json()
		console.log('[HACKATIME] Projects fetched:', data.projects?.length || 0)

		return {
			projects: data.projects.map((p) => ({
				name: p.name,
				hours: Math.round(p.total_seconds / 3600 * 10) / 10,
				repoUrl: p.repo_url,
				languages: p.languages
			}))
		}
	} catch (error) {
		console.error('[HACKATIME] Error fetching projects:', error)
		return { projects: [] }
	}
})

export default hackatime
