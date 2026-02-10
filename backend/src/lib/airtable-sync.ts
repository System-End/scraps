import Airtable from 'airtable'
import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { usersTable } from '../schemas/users'
import { userActivityTable } from '../schemas/user-emails'
import { projectActivityTable } from '../schemas/activity'
import { reviewsTable } from '../schemas/reviews'
import { config } from '../config'
import { eq, and, or, isNull, min, sql, inArray } from 'drizzle-orm'
import { fetchUserInfo } from './auth'

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

let syncInterval: ReturnType<typeof setInterval> | null = null

function getBase(): Airtable.Base | null {
	if (!config.airtableToken || !config.airtableBaseId) {
		console.log('[AIRTABLE-SYNC] Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID, skipping sync')
		return null
	}

	const airtable = new Airtable({ apiKey: config.airtableToken })
	return airtable.base(config.airtableBaseId)
}

function formatHoursMinutes(hours: number): string {
	const totalMinutes = Math.round(hours * 60)
	const h = Math.floor(totalMinutes / 60)
	const m = totalMinutes % 60
	if (h === 0) return `${m}min`
	if (m === 0) return `${h}h`
	return `${h}h ${m}min`
}

function buildJustification(project: {
	id: number
	hours: number | null
	hoursOverride: number | null
}, reviews: {
	action: string
	reviewerName: string | null
	createdAt: Date
}[]): string {
	const effectiveHours = project.hoursOverride ?? project.hours ?? 0
	const lines: string[] = []

	lines.push(`The user logged ${formatHoursMinutes(effectiveHours)} on hackatime.`)
	lines.push('')
	lines.push(`The scraps project can be found at ${config.frontendUrl}/projects/${project.id}`)

	if (reviews.length > 0) {
		lines.push('')
		lines.push('Review history:')
		for (const review of reviews) {
			const reviewerName = review.reviewerName || 'Unknown'
			const date = review.createdAt.toISOString().split('T')[0]
			lines.push(`- ${reviewerName} ${review.action} on ${date}`)
		}
	}

	lines.push('')
	lines.push(`Full review history can be found at ${config.frontendUrl}/admin/reviews/${project.id}`)

	return lines.join('\n')
}

async function syncProjectsToAirtable(): Promise<void> {
	const base = getBase()
	if (!base) return

	console.log('[AIRTABLE-SYNC] Syncing shipped projects...')

	try {
		// Get all shipped projects with user data
		const projects = await db
			.select({
				id: projectsTable.id,
				name: projectsTable.name,
				description: projectsTable.description,
				image: projectsTable.image,
				githubUrl: projectsTable.githubUrl,
				playableUrl: projectsTable.playableUrl,
				hours: projectsTable.hours,
				hoursOverride: projectsTable.hoursOverride,
				tier: projectsTable.tier,
				status: projectsTable.status,
				updateDescription: projectsTable.updateDescription,
				aiDescription: projectsTable.aiDescription,
				feedbackSource: projectsTable.feedbackSource,
				feedbackGood: projectsTable.feedbackGood,
				feedbackImprove: projectsTable.feedbackImprove,
				createdAt: projectsTable.createdAt,
				userId: projectsTable.userId,
				username: usersTable.username,
				email: usersTable.email,
				slackId: usersTable.slackId,
				accessToken: usersTable.accessToken
			})
			.from(projectsTable)
			.innerJoin(usersTable, eq(projectsTable.userId, usersTable.id))
			.where(and(
				eq(projectsTable.status, 'shipped'),
				or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted))
			))

		// Fetch all reviews for shipped projects with reviewer usernames
		const projectIds = projects.map(p => p.id)
		let reviewsByProjectId = new Map<number, { action: string; reviewerName: string | null; createdAt: Date }[]>()
		if (projectIds.length > 0) {
			const allReviews = await db
				.select({
					projectId: reviewsTable.projectId,
					action: reviewsTable.action,
					createdAt: reviewsTable.createdAt,
					reviewerUsername: usersTable.username
				})
				.from(reviewsTable)
				.leftJoin(usersTable, eq(reviewsTable.reviewerId, usersTable.id))
				.where(inArray(reviewsTable.projectId, projectIds))

			for (const review of allReviews) {
				const existing = reviewsByProjectId.get(review.projectId) || []
				existing.push({
					action: review.action,
					reviewerName: review.reviewerUsername,
					createdAt: review.createdAt
				})
				reviewsByProjectId.set(review.projectId, existing)
			}
		}

		const table = base(config.airtableProjectsTableId)

		// Fetch existing records from Airtable to find which ones to update vs create
		const existingRecords: Map<string, string> = new Map() // github_url -> airtable record id
		await new Promise<void>((resolve, reject) => {
			table.select({
				fields: ['Code URL']
			}).eachPage(
				(records, fetchNextPage) => {
					for (const record of records) {
						const githubUrl = record.get('Code URL')
						if (githubUrl) {
							existingRecords.set(String(githubUrl), record.id)
						}
					}
					fetchNextPage()
				},
				(err) => {
					if (err) reject(err)
					else resolve()
				}
			)
		})

		const toCreate: Airtable.FieldSet[] = []
		const toUpdate: { id: string; fields: Airtable.FieldSet }[] = []
		const duplicateProjectIds: number[] = [] // projects with duplicate Code URLs to revert

		// Cache userinfo per userId to avoid redundant API calls
		const userInfoCache: Map<number, Awaited<ReturnType<typeof fetchUserInfo>>> = new Map()

		// Track which Code URLs we've already seen to detect duplicates
		const seenCodeUrls = new Set<string>()

		for (const project of projects) {
			if (!project.githubUrl) continue // skip projects without a GitHub URL
			if (!project.image) continue // screenshot must exist

			// Check for duplicate Code URL among shipped projects
			if (seenCodeUrls.has(project.githubUrl)) {
				console.log(`[AIRTABLE-SYNC] Duplicate Code URL detected for project ${project.id}: ${project.githubUrl}, reverting to waiting_for_review`)
				duplicateProjectIds.push(project.id)
				continue
			}
			seenCodeUrls.add(project.githubUrl)

			// Fetch userinfo if not cached
			if (!userInfoCache.has(project.userId) && project.accessToken) {
				const info = await fetchUserInfo(project.accessToken)
				userInfoCache.set(project.userId, info)
			}
			const userInfo = userInfoCache.get(project.userId)

			const effectiveHours = project.hoursOverride ?? project.hours ?? 0

			const firstName = userInfo?.given_name || (project.username || '').split(' ')[0] || ''
			const lastName = userInfo?.family_name || (project.username || '').split(' ').slice(1).join(' ') || ''

			const descriptionParts = [project.description || '']
			if (project.updateDescription) {
				descriptionParts.push(`\nThis project is an update. ${project.updateDescription}`)
			}
			if (project.aiDescription) {
				descriptionParts.push(`\nAI was used in this project. ${project.aiDescription}`)
			}

			const fields: Airtable.FieldSet = {
				'Code URL': project.githubUrl,
				'Description': descriptionParts.join('\n'),
				'Email': project.email || '',
				'First Name': firstName,
				'Last Name': lastName,
				'GitHub Username': project.username || '',
				'How can we improve?': project.feedbackImprove || '',
				'How did you hear about this?': project.feedbackSource || '',
				'What are we doing well?': project.feedbackGood || '',
				'Slack ID': project.slackId || '',
				'Optional - Override Hours Spent': effectiveHours,
				'Optional - Override Hours Spent Justification': buildJustification(
					project,
					reviewsByProjectId.get(project.id) || []
				),
				'Playable URL': project.playableUrl || '',
				'Screenshot': [{ url: project.image }] as any,
			}

			// Add address fields from userinfo
			if (userInfo?.address) {
				if (userInfo.address.street_address) {
					const lines = userInfo.address.street_address.split('\n')
					if (lines[0]) fields['Address (Line 1)'] = lines[0]
					if (lines[1]) fields['Address (Line 2)'] = lines[1]
				}
				if (userInfo.address.locality) fields['City'] = userInfo.address.locality
				if (userInfo.address.region) fields['State / Province'] = userInfo.address.region
				if (userInfo.address.postal_code) fields['ZIP / Postal Code'] = userInfo.address.postal_code
				if (userInfo.address.country) fields['Country'] = userInfo.address.country
			}

			// Add birthday from userinfo
			if (userInfo?.birthdate) {
				fields['Birthday'] = userInfo.birthdate
			}

			const existingId = existingRecords.get(project.githubUrl)
			if (existingId) {
				toUpdate.push({ id: existingId, fields })
			} else {
				toCreate.push(fields)
			}
		}

		// Airtable API allows max 10 records per request
		for (let i = 0; i < toCreate.length; i += 10) {
			const batch = toCreate.slice(i, i + 10)
			await table.create(batch.map(fields => ({ fields })))
		}

		// Deduplicate toUpdate by Airtable record ID (keep last occurrence)
		const deduplicatedUpdates = new Map<string, { id: string; fields: Airtable.FieldSet }>()
		for (const update of toUpdate) {
			deduplicatedUpdates.set(update.id, update)
		}
		const uniqueUpdates = Array.from(deduplicatedUpdates.values())

		for (let i = 0; i < uniqueUpdates.length; i += 10) {
			const batch = uniqueUpdates.slice(i, i + 10)
			await table.update(batch)
		}

		// Revert duplicate projects back to waiting_for_review
		for (const projectId of duplicateProjectIds) {
			await db
				.update(projectsTable)
				.set({ status: 'waiting_for_review', updatedAt: new Date() })
				.where(eq(projectsTable.id, projectId))
		}
		if (duplicateProjectIds.length > 0) {
			console.log(`[AIRTABLE-SYNC] Reverted ${duplicateProjectIds.length} duplicate projects back to waiting_for_review`)
		}

		console.log(`[AIRTABLE-SYNC] Projects: ${toCreate.length} created, ${uniqueUpdates.length} updated`)
	} catch (error) {
		console.error('[AIRTABLE-SYNC] Error syncing projects:', error)
	}
}

async function syncUsersToAirtable(): Promise<void> {
	const base = getBase()
	if (!base) return

	console.log('[AIRTABLE-SYNC] Syncing users...')

	try {
		const users = await db
			.select({
				id: usersTable.id,
				slackId: usersTable.slackId,
				email: usersTable.email,
				createdAt: usersTable.createdAt,
				tutorialCompleted: usersTable.tutorialCompleted
			})
			.from(usersTable)

		const table = base(config.airtableUsersTableId)

		// Fetch existing records
		const existingRecords: Map<string, string> = new Map() // slack_id -> airtable record id
		await new Promise<void>((resolve, reject) => {
			table.select({
				fields: ['slack_id']
			}).eachPage(
				(records, fetchNextPage) => {
					for (const record of records) {
						const slackId = record.get('slack_id')
						if (slackId) {
							existingRecords.set(String(slackId), record.id)
						}
					}
					fetchNextPage()
				},
				(err) => {
					if (err) reject(err)
					else resolve()
				}
			)
		})

		// Batch-fetch auth_started and auth_completed timestamps from user_activity
		const authStartedRows = await db
			.select({
				userId: userActivityTable.userId,
				earliest: min(userActivityTable.createdAt)
			})
			.from(userActivityTable)
			.where(eq(userActivityTable.action, 'auth_started'))
			.groupBy(userActivityTable.userId)

		const authCompletedRows = await db
			.select({
				userId: userActivityTable.userId,
				earliest: min(userActivityTable.createdAt)
			})
			.from(userActivityTable)
			.where(eq(userActivityTable.action, 'auth_completed'))
			.groupBy(userActivityTable.userId)

		// Batch-fetch tutorial_completed timestamps from user_activity
		const tutorialCompletedRows = await db
			.select({
				userId: userActivityTable.userId,
				earliest: min(userActivityTable.createdAt)
			})
			.from(userActivityTable)
			.where(eq(userActivityTable.action, 'tutorial_completed'))
			.groupBy(userActivityTable.userId)

		// Batch-fetch earliest project_created from project_activity
		const firstProjectRows = await db
			.select({
				userId: projectActivityTable.userId,
				earliest: min(projectActivityTable.createdAt)
			})
			.from(projectActivityTable)
			.where(eq(projectActivityTable.action, 'project_created'))
			.groupBy(projectActivityTable.userId)

		// Batch-fetch earliest project_submitted from project_activity
		const firstProjectSubmittedRows = await db
			.select({
				userId: projectActivityTable.userId,
				earliest: min(projectActivityTable.createdAt)
			})
			.from(projectActivityTable)
			.where(eq(projectActivityTable.action, 'project_submitted'))
			.groupBy(projectActivityTable.userId)

		// Batch-fetch earliest project_shipped from project_activity
		const firstProjectShippedRows = await db
			.select({
				userId: projectActivityTable.userId,
				earliest: min(projectActivityTable.createdAt)
			})
			.from(projectActivityTable)
			.where(eq(projectActivityTable.action, 'project_shipped'))
			.groupBy(projectActivityTable.userId)

		// Batch-fetch hour milestone timestamps from user_activity
		const hourMilestoneActions = ['scrapsOneHour', 'scrapsFiveHours', 'scrapsTenHours', 'scrapsTwentyHours'] as const
		const hourMilestoneRows = await db
			.select({
				userId: userActivityTable.userId,
				action: userActivityTable.action,
				earliest: min(userActivityTable.createdAt)
			})
			.from(userActivityTable)
			.where(sql`${userActivityTable.action} IN ('scrapsOneHour', 'scrapsFiveHours', 'scrapsTenHours', 'scrapsTwentyHours')`)
			.groupBy(userActivityTable.userId, userActivityTable.action)

		const authStartedMap = new Map(authStartedRows.filter(r => r.userId != null).map(r => [r.userId!, r.earliest]))
		const authCompletedMap = new Map(authCompletedRows.filter(r => r.userId != null).map(r => [r.userId!, r.earliest]))
		const tutorialCompletedMap = new Map(tutorialCompletedRows.filter(r => r.userId != null).map(r => [r.userId!, r.earliest]))
		const firstProjectMap = new Map(firstProjectRows.map(r => [r.userId, r.earliest]))
		const firstProjectSubmittedMap = new Map(firstProjectSubmittedRows.map(r => [r.userId, r.earliest]))
		const firstProjectShippedMap = new Map(firstProjectShippedRows.map(r => [r.userId, r.earliest]))

		// Build per-user maps for hour milestones
		const hourMilestoneMap = new Map<number, Map<string, Date | null>>()
		for (const row of hourMilestoneRows) {
			if (row.userId == null) continue
			if (!hourMilestoneMap.has(row.userId)) {
				hourMilestoneMap.set(row.userId, new Map())
			}
			hourMilestoneMap.get(row.userId)!.set(row.action, row.earliest)
		}

		const toCreate: Airtable.FieldSet[] = []
		const toUpdate: { id: string; fields: Airtable.FieldSet }[] = []

		for (const user of users) {
			if (!user.slackId) continue

			const authStarted = authStartedMap.get(user.id)
			const authCompleted = authCompletedMap.get(user.id)
			const tutorialCompleted = tutorialCompletedMap.get(user.id)
			const firstProjectCreated = firstProjectMap.get(user.id)
			const firstProjectSubmitted = firstProjectSubmittedMap.get(user.id)
			const firstProjectShipped = firstProjectShippedMap.get(user.id)
			const userMilestones = hourMilestoneMap.get(user.id)

			const fields: Airtable.FieldSet = {
				'slack_id': user.slackId,
				'email': user.email || '',
			}

			if (authStarted) {
				fields['Loops - scrapsAuthStarted'] = authStarted.toISOString()
			} else if (user.tutorialCompleted) {
				fields['Loops - scrapsAuthStarted'] = user.createdAt.toISOString()
			}
			if (authCompleted) {
				fields['Loops - scrapsAuthFinished'] = authCompleted.toISOString()
			} else if (user.tutorialCompleted) {
				fields['Loops - scrapsAuthFinished'] = user.createdAt.toISOString()
			}
			if (user.tutorialCompleted) {
				fields['Loops - scrapsTutorialCompleted'] = tutorialCompleted
					? tutorialCompleted.toISOString()
					: user.createdAt.toISOString()
			}
			if (firstProjectCreated) {
				fields['Loops - scrapsFirstProjectCreated'] = firstProjectCreated.toISOString()
			}
			if (firstProjectSubmitted) {
				fields['Loops - scrapsFirstProjectSubmitted'] = firstProjectSubmitted.toISOString()
			}
			if (firstProjectShipped) {
				fields['Loops - scrapsFirstProjectShipped'] = firstProjectShipped.toISOString()
			}
			if (userMilestones) {
				const oneHour = userMilestones.get('scrapsOneHour')
				const fiveHours = userMilestones.get('scrapsFiveHours')
				const tenHours = userMilestones.get('scrapsTenHours')
				const twentyHours = userMilestones.get('scrapsTwentyHours')
				if (oneHour) fields['Loops - scrapsOneHour'] = oneHour.toISOString()
				if (fiveHours) fields['Loops - scrapsFiveHours'] = fiveHours.toISOString()
				if (tenHours) fields['Loops - scrapsTenHours'] = tenHours.toISOString()
				if (twentyHours) fields['Loops - scrapsTwentyHours'] = twentyHours.toISOString()
			}

			const existingId = existingRecords.get(user.slackId)
			if (existingId) {
				toUpdate.push({ id: existingId, fields })
			} else {
				toCreate.push(fields)
			}
		}

		// Airtable API allows max 10 records per request
		for (let i = 0; i < toCreate.length; i += 10) {
			const batch = toCreate.slice(i, i + 10)
			await table.create(batch.map(fields => ({ fields })))
		}

		for (let i = 0; i < toUpdate.length; i += 10) {
			const batch = toUpdate.slice(i, i + 10)
			await table.update(batch)
		}

		console.log(`[AIRTABLE-SYNC] Users: ${toCreate.length} created, ${toUpdate.length} updated`)
	} catch (error) {
		console.error('[AIRTABLE-SYNC] Error syncing users:', error)
	}
}

async function syncAll(): Promise<void> {
	await syncProjectsToAirtable()
	await syncUsersToAirtable()
}

export function startAirtableSync(): void {
	if (syncInterval) return

	if (!config.airtableToken || !config.airtableBaseId) {
		console.log('[AIRTABLE-SYNC] Missing AIRTABLE_TOKEN or AIRTABLE_BASE_ID, sync disabled')
		return
	}

	console.log('[AIRTABLE-SYNC] Starting background sync (every 5 minutes)')

	// Run immediately on start
	syncAll()

	// Then run every 5 minutes
	syncInterval = setInterval(syncAll, SYNC_INTERVAL_MS)
}

export function stopAirtableSync(): void {
	if (syncInterval) {
		clearInterval(syncInterval)
		syncInterval = null
		console.log('[AIRTABLE-SYNC] Stopped background sync')
	}
}
