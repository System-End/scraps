import { Elysia } from 'elysia'
import { getUserFromSession } from '../lib/auth'
import { config } from '../config'

const HACKATIME_ADMIN_API = 'https://hackatime.hackclub.com/api/admin/v1'
const SCRAPS_START_DATE = '2026-02-03'

interface HackatimeAdminProject {
	name: string
	total_heartbeats: number
	total_duration: number
	first_heartbeat: number
	last_heartbeat: number
	languages: string[]
	repo: string | null
	repo_mapping_id: number | null
	archived: boolean
}

interface HackatimeAdminProjectsResponse {
	user_id: number
	username: string
	projects: HackatimeAdminProject[]
}

const hackatime = new Elysia({ prefix: '/hackatime' })

hackatime.get('/projects', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) return { error: 'Unauthorized' }

	if (!user.email) {
		console.log('[HACKATIME] No email found for user:', user.id)
		return { error: 'No email found for user', projects: [] }
	}

	try {
		// Step 1: Get hackatime user_id by email
		const emailResponse = await fetch(`${HACKATIME_ADMIN_API}/user/get_user_by_email`, {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Content-Type': 'application/json',
				'Accept': 'application/json'
			},
			body: JSON.stringify({ email: user.email })
		})

		if (!emailResponse.ok) {
			const errorText = await emailResponse.text()
			console.log('[HACKATIME] Email lookup error:', { status: emailResponse.status, body: errorText })
			return { projects: [] }
		}

		const { user_id } = await emailResponse.json() as { user_id: number }
		console.log('[HACKATIME] Found hackatime user_id:', user_id, 'for email:', user.email)

		// Step 2: Get projects via admin endpoint with start_date
		const projectsParams = new URLSearchParams({
			user_id: String(user_id),
			start_date: SCRAPS_START_DATE
		})
		const projectsUrl = `${HACKATIME_ADMIN_API}/user/projects?${projectsParams}`
		console.log('[HACKATIME] Fetching admin projects:', projectsUrl)

		const projectsResponse = await fetch(projectsUrl, {
			headers: {
				'Authorization': `Bearer ${config.hackatimeAdminKey}`,
				'Accept': 'application/json'
			}
		})

		if (!projectsResponse.ok) {
			const errorText = await projectsResponse.text()
			console.log('[HACKATIME] Projects API error:', { status: projectsResponse.status, body: errorText })
			return { projects: [] }
		}

		const data: HackatimeAdminProjectsResponse = await projectsResponse.json()
		const projects = data.projects || []
		console.log('[HACKATIME] Projects fetched:', projects.length)

		return {
			slackId: user.slackId,
			projects: projects.map((p) => ({
				name: p.name,
				hours: Math.round(p.total_duration / 3600 * 10) / 10,
				repoUrl: p.repo || null,
				languages: p.languages || []
			}))
		}
	} catch (error) {
		console.error('[HACKATIME] Error fetching projects:', error)
		return { projects: [] }
	}
})

export default hackatime
