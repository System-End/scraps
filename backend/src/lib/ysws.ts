import { config } from '../config'

const YSWS_API_URL = 'https://joe.fraud.hackclub.com/api/v1/ysws/events/new-ui-api'

export async function submitProjectToYSWS(project: {
	name: string
	githubUrl: string | null
	playableUrl: string | null
	hackatimeProject: string | null
	slackId: string | null
}) {
	if (!config.fraudToken) {
		console.log('[YSWS] Missing FRAUD_TOKEN, skipping submission')
		return null
	}

	const hackatimeProjects = project.hackatimeProject
		? project.hackatimeProject.split(',').map(n => n.trim()).filter(n => n.length > 0)
		: []

	const payload = {
		name: project.name,
		codeLink: project.githubUrl || '',
		demoLink: project.playableUrl || '',
		submitter: {
			slackId: project.slackId || ''
		},
		hackatimeProjects
	}

	try {
		const res = await fetch(`${YSWS_API_URL}/projects`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${config.fraudToken}`
			},
			body: JSON.stringify(payload)
		})

		if (!res.ok) {
			const text = await res.text()
			console.error('[YSWS] submission failed:', res.status, text)
			return null
		}

		const data = await res.json()
		console.log('[YSWS] submitted project:', project.name)
		return data
	} catch (e) {
		console.error('[YSWS] submission error:', e)
		return null
	}
}
