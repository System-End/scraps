import { Elysia } from 'elysia'
import { eq, and, sql, desc, inArray, or, isNull, ilike } from 'drizzle-orm'
import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { reviewsTable } from '../schemas/reviews'
import { usersTable } from '../schemas/users'
import { activityTable } from '../schemas/activity'
import { getUserFromSession } from '../lib/auth'

const HACKATIME_API = 'https://hackatime.hackclub.com/api/v1'

interface HackatimeProject {
    name: string
    total_seconds: number
}

interface HackatimeResponse {
    projects: HackatimeProject[]
}

async function fetchHackatimeHours(slackId: string, projectName: string): Promise<number> {
    try {
        const url = `${HACKATIME_API}/users/${encodeURIComponent(slackId)}/projects/details`
        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        })
        if (!response.ok) return 0
        
        const data: HackatimeResponse = await response.json()
        const project = data.projects.find(p => p.name === projectName)
        if (!project) return 0
        
        return Math.round(project.total_seconds / 3600 * 10) / 10
    } catch {
        return 0
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

const projects = new Elysia({ prefix: '/projects' })

// Public explore endpoint - returns minimal data for browsing
projects.get('/explore', async ({ query }) => {
    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 50)
    const offset = (page - 1) * limit
    const search = (query.search as string)?.trim() || ''
    const tier = query.tier ? parseInt(query.tier as string) : null
    const status = query.status as string || null

    const conditions = [
        or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted)),
        or(eq(projectsTable.status, 'shipped'), eq(projectsTable.status, 'in_progress'))
    ]

    if (search) {
        conditions.push(
            or(
                ilike(projectsTable.name, `%${search}%`),
                ilike(projectsTable.description, `%${search}%`)
            )!
        )
    }

    if (tier && tier >= 1 && tier <= 4) {
        conditions.push(eq(projectsTable.tier, tier))
    }

    if (status === 'shipped' || status === 'in_progress') {
        // Replace the default status condition with specific one
        conditions[1] = eq(projectsTable.status, status)
    }

    const whereClause = and(...conditions)

    const [projectsList, countResult] = await Promise.all([
        db.select({
            id: projectsTable.id,
            name: projectsTable.name,
            description: projectsTable.description,
            image: projectsTable.image,
            hours: projectsTable.hours,
            tier: projectsTable.tier,
            status: projectsTable.status,
            views: projectsTable.views,
            userId: projectsTable.userId
        })
        .from(projectsTable)
        .where(whereClause)
        .orderBy(desc(projectsTable.updatedAt))
        .limit(limit)
        .offset(offset),
        db.select({ count: sql<number>`count(*)` })
        .from(projectsTable)
        .where(whereClause)
    ])

    // Fetch usernames for all projects
    const userIds = [...new Set(projectsList.map(p => p.userId))]
    let users: { id: number; username: string | null }[] = []
    if (userIds.length > 0) {
        users = await db
            .select({ id: usersTable.id, username: usersTable.username })
            .from(usersTable)
            .where(inArray(usersTable.id, userIds))
    }

    const total = Number(countResult[0]?.count || 0)

    return {
        data: projectsList.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description.substring(0, 150) + (p.description.length > 150 ? '...' : ''),
            image: p.image,
            hours: p.hours,
            tier: p.tier,
            status: p.status,
            views: p.views,
            username: users.find(u => u.id === p.userId)?.username || null
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }
})

projects.get('/', async ({ headers, query }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100)
    const offset = (page - 1) * limit

    const [projectsList, countResult] = await Promise.all([
        db.select().from(projectsTable)
            .where(and(
                eq(projectsTable.userId, user.id),
                or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted))
            ))
            .orderBy(desc(projectsTable.updatedAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(projectsTable)
            .where(and(
                eq(projectsTable.userId, user.id),
                or(eq(projectsTable.deleted, 0), isNull(projectsTable.deleted))
            ))
    ])

    const total = Number(countResult[0]?.count || 0)

    return {
        data: projectsList,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }
})

projects.get('/:id', async ({ params, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const project = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, parseInt(params.id)))
        .limit(1)

    if (!project[0]) return { error: 'Not found' }

    const isOwner = project[0].userId === user.id

    // If not owner, only show shipped or in_progress projects
    if (!isOwner && project[0].status !== 'shipped' && project[0].status !== 'in_progress') {
        return { error: 'Not found' }
    }

    // Increment view count if not owner
    if (!isOwner) {
        await db
            .update(projectsTable)
            .set({ views: sql`${projectsTable.views} + 1` })
            .where(eq(projectsTable.id, parseInt(params.id)))
    }

    const projectOwner = await db
        .select({ id: usersTable.id, username: usersTable.username, avatar: usersTable.avatar })
        .from(usersTable)
        .where(eq(usersTable.id, project[0].userId))
        .limit(1)

    // Fetch activity (reviews) for owner
    let activity: Array<{
        type: string
        action?: string
        feedbackForAuthor?: string | null
        createdAt: Date | null
        reviewer?: { id: number; username: string | null; avatar: string | null } | null
    }> = []

    if (isOwner) {
        const reviews = await db
            .select({
                id: reviewsTable.id,
                reviewerId: reviewsTable.reviewerId,
                action: reviewsTable.action,
                feedbackForAuthor: reviewsTable.feedbackForAuthor,
                createdAt: reviewsTable.createdAt
            })
            .from(reviewsTable)
            .where(eq(reviewsTable.projectId, parseInt(params.id)))

        const reviewerIds = reviews.map(r => r.reviewerId)
        let reviewers: { id: number; username: string | null; avatar: string | null }[] = []
        if (reviewerIds.length > 0) {
            reviewers = await db
                .select({ id: usersTable.id, username: usersTable.username, avatar: usersTable.avatar })
                .from(usersTable)
                .where(inArray(usersTable.id, reviewerIds))
        }

        // Add review entries
        for (const r of reviews) {
            activity.push({
                type: 'review',
                action: r.action,
                feedbackForAuthor: r.feedbackForAuthor,
                createdAt: r.createdAt,
                reviewer: reviewers.find(rv => rv.id === r.reviewerId) || null
            })
        }

        // Fetch submission and scraps earned events from activity table
        const activityEntries = await db
            .select({
                id: activityTable.id,
                action: activityTable.action,
                createdAt: activityTable.createdAt
            })
            .from(activityTable)
            .where(and(
                eq(activityTable.projectId, parseInt(params.id)),
                or(
                    eq(activityTable.action, 'project_submitted'),
                    sql`${activityTable.action} LIKE 'earned % scraps'`
                )
            ))

        for (const entry of activityEntries) {
            if (entry.action === 'project_submitted') {
                activity.push({
                    type: 'submitted',
                    createdAt: entry.createdAt
                })
            } else if (entry.action.startsWith('earned ') && entry.action.endsWith(' scraps')) {
                activity.push({
                    type: 'scraps_earned',
                    action: entry.action,
                    createdAt: entry.createdAt
                })
            }
        }

        // Add "project created" entry
        activity.push({
            type: 'created',
            createdAt: project[0].createdAt
        })

        // Sort by date descending (newest first)
        activity.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return dateB - dateA
        })
    }

    return {
        project: {
            id: project[0].id,
            name: project[0].name,
            description: project[0].description,
            image: project[0].image,
            githubUrl: project[0].githubUrl,
            playableUrl: project[0].playableUrl,
            hackatimeProject: isOwner ? project[0].hackatimeProject : undefined,
            hours: project[0].hoursOverride ?? project[0].hours,
            hoursOverride: isOwner ? project[0].hoursOverride : undefined,
            tier: project[0].tier,
            tierOverride: isOwner ? project[0].tierOverride : undefined,
            status: project[0].status,
            scrapsAwarded: project[0].scrapsAwarded,
            views: project[0].views,
            createdAt: project[0].createdAt,
            updatedAt: project[0].updatedAt
        },
        owner: projectOwner[0] || null,
        isOwner,
        activity: isOwner ? activity : undefined
    }
})

projects.post('/', async ({ body, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const data = body as {
        name: string
        description: string
        image?: string
        githubUrl?: string
        hackatimeProject?: string
        tier?: number
    }

    let hours = 0
    const parsed = parseHackatimeProject(data.hackatimeProject || null)
    if (parsed) {
        hours = await fetchHackatimeHours(parsed.slackId, parsed.projectName)
    }

    const tier = data.tier !== undefined ? Math.max(1, Math.min(4, data.tier)) : 1

    const newProject = await db
        .insert(projectsTable)
        .values({
            userId: user.id,
            name: data.name,
            description: data.description,
            image: data.image || null,
            githubUrl: data.githubUrl || null,
            hackatimeProject: data.hackatimeProject || null,
            hours,
            tier
        })
        .returning()

    await db.insert(activityTable).values({
        userId: user.id,
        projectId: newProject[0].id,
        action: 'project_created'
    })

    return newProject[0]
})

projects.put('/:id', async ({ params, body, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    // Check if project exists and is owned by user
    const existing = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .limit(1)

    if (!existing[0]) return { error: 'Not found' }

    // Reject edits while waiting for review
    if (existing[0].status === 'waiting_for_review') {
        return { error: 'Cannot edit project while waiting for review' }
    }

    const data = body as {
        name?: string
        description?: string
        image?: string | null
        githubUrl?: string | null
        playableUrl?: string | null
        hackatimeProject?: string | null
        tier?: number
    }

    let hours = 0
    const parsed = parseHackatimeProject(data.hackatimeProject || null)
    if (parsed) {
        hours = await fetchHackatimeHours(parsed.slackId, parsed.projectName)
    }

    const tier = data.tier !== undefined ? Math.max(1, Math.min(4, data.tier)) : undefined

    const updated = await db
        .update(projectsTable)
        .set({
            name: data.name,
            description: data.description,
            image: data.image,
            githubUrl: data.githubUrl,
            playableUrl: data.playableUrl,
            hackatimeProject: data.hackatimeProject,
            hours,
            tier,
            updatedAt: new Date()
        })
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .returning()

    return updated[0] || { error: 'Not found' }
})

projects.delete("/:id", async ({ params, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: "Unauthorized" }

    const updated = await db
        .update(projectsTable)
        .set({ deleted: 1, updatedAt: new Date() })
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .returning()

    if (!updated[0]) return { error: "Not found" }

    await db.insert(activityTable).values({
        userId: user.id,
        projectId: updated[0].id,
        action: 'project_deleted'
    })

    return { success: true }
})

// Submit project for review
projects.post("/:id/submit", async ({ params, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: "Unauthorized" }

    const project = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .limit(1)

    if (!project[0]) return { error: "Not found" }

    if (project[0].status !== 'in_progress') {
        return { error: "Project cannot be submitted in current status" }
    }

    let hours = project[0].hours
    const parsed = parseHackatimeProject(project[0].hackatimeProject)
    if (parsed) {
        hours = await fetchHackatimeHours(parsed.slackId, parsed.projectName)
    }

    const updated = await db
        .update(projectsTable)
        .set({ status: 'waiting_for_review', hours, updatedAt: new Date() })
        .where(eq(projectsTable.id, parseInt(params.id)))
        .returning()

    await db.insert(activityTable).values({
        userId: user.id,
        projectId: updated[0].id,
        action: 'project_submitted'
    })

    return updated[0]
})

// Get project reviews (public feedback)
projects.get("/:id/reviews", async ({ params, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: "Unauthorized" }

    const project = await db
        .select()
        .from(projectsTable)
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .limit(1)

    if (!project[0]) return { error: "Not found" }

    const reviews = await db
        .select({
            id: reviewsTable.id,
            reviewerId: reviewsTable.reviewerId,
            action: reviewsTable.action,
            feedbackForAuthor: reviewsTable.feedbackForAuthor,
            createdAt: reviewsTable.createdAt
        })
        .from(reviewsTable)
        .where(eq(reviewsTable.projectId, parseInt(params.id)))

    const reviewerIds = reviews.map(r => r.reviewerId)
    let reviewers: { id: number; username: string | null; avatar: string | null }[] = []
    if (reviewerIds.length > 0) {
        reviewers = await db
            .select({ id: usersTable.id, username: usersTable.username, avatar: usersTable.avatar })
            .from(usersTable)
            .where(inArray(usersTable.id, reviewerIds))
    }

    return reviews.map(r => ({
        id: r.id,
        action: r.action,
        feedbackForAuthor: r.feedbackForAuthor,
        createdAt: r.createdAt,
        reviewer: reviewers.find(rv => rv.id === r.reviewerId) || null
    }))
})

export default projects
