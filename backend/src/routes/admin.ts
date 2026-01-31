import { Elysia } from 'elysia'
import { eq, and, inArray, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { usersTable } from '../schemas/users'
import { projectsTable } from '../schemas/projects'
import { reviewsTable } from '../schemas/reviews'
import { getUserFromSession } from '../lib/auth'

const admin = new Elysia({ prefix: '/admin' })

async function requireReviewer(headers: Record<string, string>) {
    const user = await getUserFromSession(headers)
    if (!user) return null
    if (user.role !== 'reviewer' && user.role !== 'admin') return null
    return user
}

async function requireAdmin(headers: Record<string, string>) {
    const user = await getUserFromSession(headers)
    if (!user) return null
    if (user.role !== 'admin') return null
    return user
}

// Get all users (reviewers see limited info)
admin.get('/users', async ({ headers, query }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100)
    const offset = (page - 1) * limit

    const [users, countResult] = await Promise.all([
        db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(usersTable)
    ])

    const total = Number(countResult[0]?.count || 0)
    
    return {
        data: users.map(u => ({
            id: u.id,
            username: u.username,
            email: user.role === 'admin' ? u.email : undefined,
            avatar: u.avatar,
            slackId: u.slackId,
            scraps: u.scraps,
            role: u.role,
            internalNotes: u.internalNotes,
            createdAt: u.createdAt
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }
})

// Update user role (admin only)
admin.put('/users/:id/role', async ({ params, body, headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { role } = body as { role: string }
    if (!['member', 'reviewer', 'admin'].includes(role)) {
        return { error: 'Invalid role' }
    }

    const updated = await db
        .update(usersTable)
        .set({ role, updatedAt: new Date() })
        .where(eq(usersTable.id, parseInt(params.id)))
        .returning()

    return updated[0] || { error: 'Not found' }
})

// Update user internal notes
admin.put('/users/:id/notes', async ({ params, body, headers }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { internalNotes } = body as { internalNotes: string }

    if (typeof internalNotes != "string" || internalNotes.length > 2500) {
        return { error: "Note is too long or it's malformed!" };
    }

    const updated = await db
        .update(usersTable)
        .set({ internalNotes, updatedAt: new Date() })
        .where(eq(usersTable.id, parseInt(params.id)))
        .returning()

    return updated[0] || { error: 'Not found' }
})

// Get projects waiting for review
admin.get('/reviews', async ({ headers, query }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100)
    const offset = (page - 1) * limit

    const [projects, countResult] = await Promise.all([
        db.select().from(projectsTable)
            .where(eq(projectsTable.status, 'waiting_for_review'))
            .orderBy(desc(projectsTable.updatedAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(projectsTable)
            .where(eq(projectsTable.status, 'waiting_for_review'))
    ])

    const total = Number(countResult[0]?.count || 0)

    return {
        data: projects,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    }
})

// Get single project for review (with user info and previous reviews)
admin.get('/reviews/:id', async ({ params, headers }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const project = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, parseInt(params.id)))
        .limit(1)

    if (project.length <= 0) return { error: "Project not found!" };

    const projectUser = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, project[0].userId))
        .limit(1)

    const reviews = await db
        .select()
        .from(reviewsTable)
        .where(eq(reviewsTable.projectId, parseInt(params.id)))

    const reviewerIds = reviews.map(r => r.reviewerId)
    let reviewers: { id: number; username: string | null }[] = []
    if (reviewerIds.length > 0) {
        reviewers = await db
            .select({ id: usersTable.id, username: usersTable.username })
            .from(usersTable)
            .where(inArray(usersTable.id, reviewerIds))
    }

    return {
        project: project[0],
        user: projectUser[0] ? {
            id: projectUser[0].id,
            username: projectUser[0].username,
            email: user.role === 'admin' ? projectUser[0].email : undefined,
            avatar: projectUser[0].avatar,
            internalNotes: projectUser[0].internalNotes
        } : null,
        reviews: reviews.map(r => ({
            ...r,
            reviewerName: reviewers.find(rv => rv.id === r.reviewerId)?.username
        }))
    }
})

// Submit a review
admin.post('/reviews/:id', async ({ params, body, headers }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { action, feedbackForAuthor, internalJustification, hoursOverride, userInternalNotes } = body as {
        action: 'approved' | 'denied' | 'permanently_rejected'
        feedbackForAuthor: string
        internalJustification?: string
        hoursOverride?: number
        userInternalNotes?: string
    }

    if (!['approved', 'denied', 'permanently_rejected'].includes(action)) {
        return { error: 'Invalid action' }
    }

    if (!feedbackForAuthor?.trim()) {
        return { error: 'Feedback for author is required' }
    }

    const projectId = parseInt(params.id)

    // Get project to find user
    const project = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId))
        .limit(1)

    if (!project[0]) return { error: 'Project not found' }

    // Create review record
    await db.insert(reviewsTable).values({
        projectId,
        reviewerId: user.id,
        action,
        feedbackForAuthor,
        internalJustification
    })

    // Update project status
    let newStatus = 'in_progress'

    switch (action) {
        case "approved":
            newStatus = "shipped";
        case "denied":
            newStatus = "in_progress";
        case "permanently_rejected":
            newStatus = "permanently_rejected";
        default:
            newStatus = action;
    }

    const updateData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date()
    }

    if (hoursOverride !== undefined) {
        updateData.hoursOverride = hoursOverride
    }

    await db
        .update(projectsTable)
        .set(updateData)
        .where(eq(projectsTable.id, projectId))

    // Update user internal notes if provided
    if (userInternalNotes !== undefined) {
        if (userInternalNotes.length <= 2500) {
            await db
                .update(usersTable)
                .set({ internalNotes: userInternalNotes, updatedAt: new Date() })
                .where(eq(usersTable.id, project[0].userId))
        }
    }

    return { success: true }
})

export default admin
