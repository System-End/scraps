import { Elysia } from 'elysia'
import { eq, and, inArray, sql, desc, or } from 'drizzle-orm'
import { db } from '../db'
import { usersTable, userBonusesTable } from '../schemas/users'
import { projectsTable } from '../schemas/projects'
import { reviewsTable } from '../schemas/reviews'
import { shopItemsTable, shopOrdersTable, shopHeartsTable } from '../schemas/shop'
import { newsTable } from '../schemas/news'
import { activityTable } from '../schemas/activity'
import { getUserFromSession } from '../lib/auth'
import { calculateScrapsFromHours, getUserScrapsBalance } from '../lib/scraps'

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
        db.select({
            id: usersTable.id,
            username: usersTable.username,
            avatar: usersTable.avatar,
            slackId: usersTable.slackId,
            role: usersTable.role,
            internalNotes: usersTable.internalNotes,
            createdAt: usersTable.createdAt,
            scrapsEarned: sql<number>`COALESCE((SELECT SUM(scraps_awarded) FROM projects WHERE user_id = ${usersTable.id}), 0)`.as('scraps_earned'),
            scrapsSpent: sql<number>`COALESCE((SELECT SUM(total_price) FROM shop_orders WHERE user_id = ${usersTable.id}), 0)`.as('scraps_spent')
        }).from(usersTable).where(searchCondition).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(usersTable).where(searchCondition)
    ])

    const total = Number(countResult[0]?.count || 0)
    
    return {
        data: users.map(u => ({
            id: u.id,
            username: u.username,
            avatar: u.avatar,
            slackId: u.slackId,
            scraps: Number(u.scrapsEarned) - Number(u.scrapsSpent),
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

    const targetUserId = parseInt(params.id)

    const targetUser = await db
        .select({
            id: usersTable.id,
            username: usersTable.username,
            avatar: usersTable.avatar,
            slackId: usersTable.slackId,
            role: usersTable.role,
            internalNotes: usersTable.internalNotes,
            createdAt: usersTable.createdAt
        })
        .from(usersTable)
        .where(eq(usersTable.id, targetUserId))
        .limit(1)

    if (!targetUser[0]) return { error: 'User not found' }

    const projects = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.userId, targetUserId))
        .orderBy(desc(projectsTable.updatedAt))

    const projectStats = {
        total: projects.length,
        shipped: projects.filter(p => p.status === 'shipped').length,
        inProgress: projects.filter(p => p.status === 'in_progress').length,
        waitingForReview: projects.filter(p => p.status === 'waiting_for_review').length,
        rejected: projects.filter(p => p.status === 'permanently_rejected').length
    }

    const totalHours = projects.reduce((sum, p) => sum + (p.hoursOverride ?? p.hours ?? 0), 0)

    const scrapsBalance = await getUserScrapsBalance(targetUserId)

    return {
        user: {
            id: targetUser[0].id,
            username: targetUser[0].username,
            avatar: targetUser[0].avatar,
            slackId: targetUser[0].slackId,
            scraps: scrapsBalance.balance,
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

// Give bonus scraps to user (admin only)
admin.post('/users/:id/bonus', async ({ params, body, headers }) => {
    const admin = await requireAdmin(headers as Record<string, string>)
    if (!admin) return { error: 'Unauthorized' }

    const { amount, reason } = body as { amount: number; reason: string }

    if (!amount || typeof amount !== 'number') {
        return { error: 'Amount is required and must be a number' }
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        return { error: 'Reason is required' }
    }

    if (reason.length > 500) {
        return { error: 'Reason is too long (max 500 characters)' }
    }

    const targetUserId = parseInt(params.id)

    const targetUser = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, targetUserId))
        .limit(1)

    if (!targetUser[0]) return { error: 'User not found' }

    const bonus = await db
        .insert(userBonusesTable)
        .values({
            userId: targetUserId,
            amount,
            reason: reason.trim(),
            givenBy: admin.id
        })
        .returning()

    return bonus[0]
})

// Get user bonuses (admin only)
admin.get('/users/:id/bonuses', async ({ params, headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const targetUserId = parseInt(params.id)

    const bonuses = await db
        .select({
            id: userBonusesTable.id,
            amount: userBonusesTable.amount,
            reason: userBonusesTable.reason,
            givenBy: userBonusesTable.givenBy,
            givenByUsername: usersTable.username,
            createdAt: userBonusesTable.createdAt
        })
        .from(userBonusesTable)
        .leftJoin(usersTable, eq(userBonusesTable.givenBy, usersTable.id))
        .where(eq(userBonusesTable.userId, targetUserId))
        .orderBy(desc(userBonusesTable.createdAt))

    return bonuses
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
        .select({
            id: usersTable.id,
            username: usersTable.username,
            avatar: usersTable.avatar,
            internalNotes: usersTable.internalNotes
        })
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

    let scrapsAwarded = 0
    if (action === 'approved') {
        const hours = hoursOverride ?? project[0].hours ?? 0
        scrapsAwarded = calculateScrapsFromHours(hours)
        updateData.scrapsAwarded = scrapsAwarded
    }

    await db
        .update(projectsTable)
        .set(updateData)
        .where(eq(projectsTable.id, projectId))

    if (action === 'approved' && scrapsAwarded > 0) {
        await db.insert(activityTable).values({
            userId: project[0].userId,
            projectId,
            action: `earned ${scrapsAwarded} scraps`
        })
    }

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

    const { name, image, description, price, category, count, baseProbability, baseUpgradeCost, costMultiplier, boostAmount } = body as {
        name: string
        image: string
        description: string
        price: number
        category: string
        count: number
        baseProbability?: number
        baseUpgradeCost?: number
        costMultiplier?: number
        boostAmount?: number
    }

    if (!name?.trim() || !image?.trim() || !description?.trim() || !category?.trim()) {
        return { error: 'All fields are required' }
    }

    if (typeof price !== 'number' || price < 0) {
        return { error: 'Invalid price' }
    }

    if (baseProbability !== undefined && (typeof baseProbability !== 'number' || baseProbability < 0 || baseProbability > 100)) {
        return { error: 'baseProbability must be between 0 and 100' }
    }

    const inserted = await db
        .insert(shopItemsTable)
        .values({
            name: name.trim(),
            image: image.trim(),
            description: description.trim(),
            price,
            category: category.trim(),
            count: count || 0,
            baseProbability: baseProbability ?? 50,
            baseUpgradeCost: baseUpgradeCost ?? 10,
            costMultiplier: costMultiplier ?? 115,
            boostAmount: boostAmount ?? 1
        })
        .returning()

    return inserted[0]
})

admin.put('/shop/items/:id', async ({ params, headers, body }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { name, image, description, price, category, count, baseProbability, baseUpgradeCost, costMultiplier, boostAmount } = body as {
        name?: string
        image?: string
        description?: string
        price?: number
        category?: string
        count?: number
        baseProbability?: number
        baseUpgradeCost?: number
        costMultiplier?: number
        boostAmount?: number
    }

    if (baseProbability !== undefined && (typeof baseProbability !== 'number' || baseProbability < 0 || baseProbability > 100)) {
        return { error: 'baseProbability must be between 0 and 100' }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (name !== undefined) updateData.name = name.trim()
    if (image !== undefined) updateData.image = image.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (price !== undefined) updateData.price = price
    if (category !== undefined) updateData.category = category.trim()
    if (count !== undefined) updateData.count = count
    if (baseProbability !== undefined) updateData.baseProbability = baseProbability
    if (baseUpgradeCost !== undefined) updateData.baseUpgradeCost = baseUpgradeCost
    if (costMultiplier !== undefined) updateData.costMultiplier = costMultiplier
    if (boostAmount !== undefined) updateData.boostAmount = boostAmount

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

    const itemId = parseInt(params.id)

    await db
        .delete(shopHeartsTable)
        .where(eq(shopHeartsTable.shopItemId, itemId))

    await db
        .delete(shopItemsTable)
        .where(eq(shopItemsTable.id, itemId))

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

admin.get('/orders', async ({ headers, query }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const status = query.status as string | undefined

    let ordersQuery = db
        .select({
            id: shopOrdersTable.id,
            quantity: shopOrdersTable.quantity,
            pricePerItem: shopOrdersTable.pricePerItem,
            totalPrice: shopOrdersTable.totalPrice,
            status: shopOrdersTable.status,
            orderType: shopOrdersTable.orderType,
            notes: shopOrdersTable.notes,
            isFulfilled: shopOrdersTable.isFulfilled,
            shippingAddress: shopOrdersTable.shippingAddress,
            createdAt: shopOrdersTable.createdAt,
            itemId: shopItemsTable.id,
            itemName: shopItemsTable.name,
            itemImage: shopItemsTable.image,
            userId: usersTable.id,
            username: usersTable.username
        })
        .from(shopOrdersTable)
        .innerJoin(shopItemsTable, eq(shopOrdersTable.shopItemId, shopItemsTable.id))
        .innerJoin(usersTable, eq(shopOrdersTable.userId, usersTable.id))
        .orderBy(desc(shopOrdersTable.createdAt))

    if (status) {
        ordersQuery = ordersQuery.where(eq(shopOrdersTable.status, status)) as typeof ordersQuery
    }

    return await ordersQuery
})

admin.patch('/orders/:id', async ({ params, body, headers }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const { status, notes, isFulfilled } = body as { status?: string; notes?: string; isFulfilled?: boolean }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
    if (status && !validStatuses.includes(status)) {
        return { error: 'Invalid status' }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (isFulfilled !== undefined) updateData.isFulfilled = isFulfilled

    const updated = await db
        .update(shopOrdersTable)
        .set(updateData)
        .where(eq(shopOrdersTable.id, parseInt(params.id)))
        .returning({
            id: shopOrdersTable.id,
            status: shopOrdersTable.status,
            notes: shopOrdersTable.notes,
            isFulfilled: shopOrdersTable.isFulfilled,
            updatedAt: shopOrdersTable.updatedAt
        })

    return updated[0] || { error: 'Not found' }
})

export default admin
