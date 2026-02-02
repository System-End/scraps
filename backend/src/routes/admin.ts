import { Elysia } from 'elysia'
import { eq, and, inArray, sql, desc, or } from 'drizzle-orm'
import { db } from '../db'
import { usersTable } from '../schemas/users'
import { projectsTable } from '../schemas/projects'
import { reviewsTable } from '../schemas/reviews'
import { shopItemsTable } from '../schemas/shop'
import { newsTable } from '../schemas/news'
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
    const search = (query.search as string)?.trim() || ''

    const searchCondition = search
        ? or(
            sql`${usersTable.username} ILIKE ${'%' + search + '%'}`,
            sql`${usersTable.email} ILIKE ${'%' + search + '%'}`,
            sql`${usersTable.slackId} ILIKE ${'%' + search + '%'}`
        )
        : undefined

    const [users, countResult] = await Promise.all([
        db.select().from(usersTable).where(searchCondition).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(usersTable).where(searchCondition)
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

// Get single user details (for admin/users/[id] page)
admin.get('/users/:id', async ({ params, headers }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const targetUser = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(params.id)))
        .limit(1)

    if (!targetUser[0]) return { error: 'User not found' }

    const projects = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.userId, parseInt(params.id)))
        .orderBy(desc(projectsTable.updatedAt))

    const projectStats = {
        total: projects.length,
        shipped: projects.filter(p => p.status === 'shipped').length,
        inProgress: projects.filter(p => p.status === 'in_progress').length,
        waitingForReview: projects.filter(p => p.status === 'waiting_for_review').length,
        rejected: projects.filter(p => p.status === 'permanently_rejected').length
    }

    const totalHours = projects.reduce((sum, p) => sum + (p.hoursOverride ?? p.hours ?? 0), 0)

    return {
        user: {
            id: targetUser[0].id,
            username: targetUser[0].username,
            email: user.role === 'admin' ? targetUser[0].email : undefined,
            avatar: targetUser[0].avatar,
            slackId: targetUser[0].slackId,
            scraps: targetUser[0].scraps,
            role: targetUser[0].role,
            internalNotes: targetUser[0].internalNotes,
            createdAt: targetUser[0].createdAt
        },
        projects,
        stats: {
            ...projectStats,
            totalHours
        }
    }
})

// Update user role (admin only)
admin.put('/users/:id/role', async ({ params, body, headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { role } = body as { role: string }
    if (!['member', 'reviewer', 'admin', 'banned'].includes(role)) {
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
    let reviewers: { id: number; username: string | null; avatar: string | null }[] = []
    if (reviewerIds.length > 0) {
        reviewers = await db
            .select({ id: usersTable.id, username: usersTable.username, avatar: usersTable.avatar })
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
        reviews: reviews.map(r => {
            const reviewer = reviewers.find(rv => rv.id === r.reviewerId)
            return {
                ...r,
                reviewerName: reviewer?.username,
                reviewerAvatar: reviewer?.avatar,
                reviewerId: r.reviewerId
            }
        })
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

    // Reject if project is deleted or not waiting for review
    if (project[0].deleted) {
        return { error: 'Cannot review a deleted project' }
    }
    if (project[0].status !== 'waiting_for_review') {
        return { error: 'Project is not marked for review' }
    }

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
            break;
        case "denied":
            newStatus = "in_progress";
            break;
        case "permanently_rejected":
            newStatus = "permanently_rejected";
            break;
        default:
            newStatus = "in_progress";
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

// Shop admin endpoints (admin only)
admin.get('/shop/items', async ({ headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const items = await db
        .select()
        .from(shopItemsTable)
        .orderBy(desc(shopItemsTable.createdAt))

    return items
})

admin.post('/shop/items', async ({ headers, body }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { name, image, description, price, category, count } = body as {
        name: string
        image: string
        description: string
        price: number
        category: string
        count: number
    }

    if (!name?.trim() || !image?.trim() || !description?.trim() || !category?.trim()) {
        return { error: 'All fields are required' }
    }

    if (typeof price !== 'number' || price < 0) {
        return { error: 'Invalid price' }
    }

    const inserted = await db
        .insert(shopItemsTable)
        .values({
            name: name.trim(),
            image: image.trim(),
            description: description.trim(),
            price,
            category: category.trim(),
            count: count || 0
        })
        .returning()

    return inserted[0]
})

admin.put('/shop/items/:id', async ({ params, headers, body }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { name, image, description, price, category, count } = body as {
        name?: string
        image?: string
        description?: string
        price?: number
        category?: string
        count?: number
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (name !== undefined) updateData.name = name.trim()
    if (image !== undefined) updateData.image = image.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (price !== undefined) updateData.price = price
    if (category !== undefined) updateData.category = category.trim()
    if (count !== undefined) updateData.count = count

    const updated = await db
        .update(shopItemsTable)
        .set(updateData)
        .where(eq(shopItemsTable.id, parseInt(params.id)))
        .returning()

    return updated[0] || { error: 'Not found' }
})

admin.delete('/shop/items/:id', async ({ params, headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    await db
        .delete(shopItemsTable)
        .where(eq(shopItemsTable.id, parseInt(params.id)))

    return { success: true }
})

// News admin endpoints (admin only)
admin.get('/news', async ({ headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const items = await db
        .select()
        .from(newsTable)
        .orderBy(desc(newsTable.createdAt))

    return items
})

admin.post('/news', async ({ headers, body }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { title, content, active } = body as {
        title: string
        content: string
        active?: boolean
    }

    if (!title?.trim() || !content?.trim()) {
        return { error: 'Title and content are required' }
    }

    const inserted = await db
        .insert(newsTable)
        .values({
            title: title.trim(),
            content: content.trim(),
            active: active ?? true
        })
        .returning()

    return inserted[0]
})

admin.put('/news/:id', async ({ params, headers, body }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { title, content, active } = body as {
        title?: string
        content?: string
        active?: boolean
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (title !== undefined) updateData.title = title.trim()
    if (content !== undefined) updateData.content = content.trim()
    if (active !== undefined) updateData.active = active

    const updated = await db
        .update(newsTable)
        .set(updateData)
        .where(eq(newsTable.id, parseInt(params.id)))
        .returning()

    return updated[0] || { error: 'Not found' }
})

admin.delete('/news/:id', async ({ params, headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    await db
        .delete(newsTable)
        .where(eq(newsTable.id, parseInt(params.id)))

    return { success: true }
})

export default admin
