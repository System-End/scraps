import { Elysia } from 'elysia'
import { eq, and, inArray, sql, desc, or } from 'drizzle-orm'
import { db } from '../db'
import { usersTable, userBonusesTable } from '../schemas/users'
import { projectsTable } from '../schemas/projects'
import { reviewsTable } from '../schemas/reviews'
import { shopItemsTable, shopOrdersTable, shopHeartsTable, shopRollsTable, refineryOrdersTable, shopPenaltiesTable } from '../schemas/shop'
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

// Get admin stats (info page)
admin.get('/stats', async ({ headers, status }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) {
        return status(401, { error: 'Unauthorized' })
    }

    const [usersCount, projectsCount, totalHoursResult, pendingHoursResult, inProgressHoursResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(usersTable),
        db.select({ count: sql<number>`count(*)` })
            .from(projectsTable)
            .where(or(eq(projectsTable.deleted, 0), sql`${projectsTable.deleted} IS NULL`)),
        db.select({ total: sql<number>`COALESCE(SUM(COALESCE(${projectsTable.hoursOverride}, ${projectsTable.hours})), 0)` })
            .from(projectsTable)
            .where(and(
                eq(projectsTable.status, 'shipped'),
                or(eq(projectsTable.deleted, 0), sql`${projectsTable.deleted} IS NULL`)
            )),
        db.select({ total: sql<number>`COALESCE(SUM(COALESCE(${projectsTable.hoursOverride}, ${projectsTable.hours})), 0)` })
            .from(projectsTable)
            .where(and(
                eq(projectsTable.status, 'waiting_for_review'),
                or(eq(projectsTable.deleted, 0), sql`${projectsTable.deleted} IS NULL`)
            )),
        db.select({ total: sql<number>`COALESCE(SUM(COALESCE(${projectsTable.hoursOverride}, ${projectsTable.hours})), 0)` })
            .from(projectsTable)
            .where(and(
                eq(projectsTable.status, 'in_progress'),
                or(eq(projectsTable.deleted, 0), sql`${projectsTable.deleted} IS NULL`)
            ))
    ])

    const totalUsers = Number(usersCount[0]?.count || 0)
    const totalProjects = Number(projectsCount[0]?.count || 0)
    const totalHours = Number(totalHoursResult[0]?.total || 0)
    const pendingHours = Number(pendingHoursResult[0]?.total || 0)
    const inProgressHours = Number(inProgressHoursResult[0]?.total || 0)
    const weightedGrants = Math.round(totalHours / 10 * 100) / 100
    const pendingWeightedGrants = Math.round(pendingHours / 10 * 100) / 100
    const inProgressWeightedGrants = Math.round(inProgressHours / 10 * 100) / 100

    return {
        totalUsers,
        totalProjects,
        totalHours: Math.round(totalHours * 10) / 10,
        weightedGrants,
        pendingHours: Math.round(pendingHours * 10) / 10,
        pendingWeightedGrants,
        inProgressHours: Math.round(inProgressHours * 10) / 10,
        inProgressWeightedGrants
    }
})

// Get all users (reviewers see limited info)
admin.get('/users', async ({ headers, query, status }) => {
    try {
        const user = await requireReviewer(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

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

        const [userIds, countResult] = await Promise.all([
            db.select({
                id: usersTable.id,
                username: usersTable.username,
                avatar: usersTable.avatar,
                slackId: usersTable.slackId,
                email: usersTable.email,
                role: usersTable.role,
                internalNotes: usersTable.internalNotes,
                createdAt: usersTable.createdAt
            }).from(usersTable).where(searchCondition).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset),
            db.select({ count: sql<number>`count(*)` }).from(usersTable).where(searchCondition)
        ])

        const total = Number(countResult[0]?.count || 0)
        
        // Get scraps balance for each user
        const usersWithScraps = await Promise.all(
            userIds.map(async (u) => {
                const balance = await getUserScrapsBalance(u.id)
                return {
                    ...u,
                    scraps: balance.balance
                }
            })
        )
        
        return {
            data: usersWithScraps.map(u => ({
                id: u.id,
                username: u.username,
                avatar: u.avatar,
                slackId: u.slackId,
                email: user.role === 'admin' ? u.email : undefined,
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
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to fetch users' })
    }
})

// Get single user details (for admin/users/[id] page)
admin.get('/users/:id', async ({ params, headers, status }) => {
    try {
        const user = await requireReviewer(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        const targetUserId = parseInt(params.id)

        const targetUser = await db
            .select({
                id: usersTable.id,
                username: usersTable.username,
                avatar: usersTable.avatar,
                slackId: usersTable.slackId,
                email: usersTable.email,
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

        const scrapsBalance = await getUserScrapsBalance(targetUserId) || 0;

        return {
            user: {
                id: targetUser[0].id,
                username: targetUser[0].username,
                avatar: targetUser[0].avatar,
                slackId: targetUser[0].slackId,
                email: user.role === 'admin' ? targetUser[0].email : undefined,
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
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to fetch user details' })
    }
})

// Update user role (admin only)
admin.put('/users/:id/role', async ({ params, body, headers, status }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) {
        return status(401, { error: 'Unauthorized' })
    }

    const { role } = body as { role: string }
    if (!['member', 'reviewer', 'admin', 'banned'].includes(role)) {
        return status(400, { error: 'Invalid role' })
    }

    if (user.id === parseInt(params.id)) {
        return status(400, { error: 'Cannot change your own role' })
    }

    try {
        const updated = await db
            .update(usersTable)
            .set({ role, updatedAt: new Date() })
            .where(eq(usersTable.id, parseInt(params.id)))
            .returning()

        if (!updated[0]) {
            return status(404, { error: "Not Found" })
        }
        return { success: true }
    } catch (err) {
        console.error(err);
        return status(500, { error: "Failed to update user role" })
    }
})

// Update user internal notes
admin.put('/users/:id/notes', async ({ params, body, headers, status }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) {
        return status(401, { error: 'Unauthorized' })
    }

    const { internalNotes } = body as { internalNotes: string }

    if (typeof internalNotes != "string" || internalNotes.length > 2500) {
        return status(400, { error: "Note is too long or it's malformed!" })
    }

    try {
        const updated = await db
            .update(usersTable)
            .set({ internalNotes, updatedAt: new Date() })
            .where(eq(usersTable.id, parseInt(params.id)))
            .returning()

        if (!updated[0]) {
            return status(404, { error: "Not Found" })
        }
        return { success: true }
    } catch (err) {
        console.error(err);
        return status(500, { error: "Failed to update user internal notes" })
    }
})

// Give bonus scraps to user (admin only)
admin.post('/users/:id/bonus', async ({ params, body, headers, status }) => {
    try {
        const admin = await requireAdmin(headers as Record<string, string>)
        if (!admin) {
            return status(401, { error: 'Unauthorized' })
        }

        const { amount, reason } = body as { amount: number; reason: string }

        if (!amount || typeof amount !== 'number') {
            return status(400, { error: 'Amount is required and must be a number' })
        }

        if (Number(amount))

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return status(400, { error: 'Reason is required' })
        }

        if (reason.length > 500) {
            return status(400, { error: 'Reason is too long (max 500 characters)' })
        }

        const targetUserId = parseInt(params.id)

        const targetUser = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.id, targetUserId))
            .limit(1)

        if (!targetUser[0]) {
            return status(404, { error: 'User not found' })
        }

        const bonus = await db
            .insert(userBonusesTable)
            .values({
                userId: targetUserId,
                amount,
                reason: reason.trim(),
                givenBy: admin.id
            })
            .returning({
                id: userBonusesTable.id,
                amount: userBonusesTable.amount,
                reason: userBonusesTable.reason,
                givenBy: userBonusesTable.givenBy,
                createdAt: userBonusesTable.createdAt
            })

        return bonus[0]
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to create user bonus' })
    }
})

// Get user bonuses (admin only)
admin.get('/users/:id/bonuses', async ({ params, headers }) => {
    try {
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
    } catch (err) {
        console.error(err)
        return { error: 'Failed to fetch user bonuses' }
    }
})

// Get projects waiting for review
admin.get('/reviews', async ({ headers, query }) => {
    try {
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
    } catch (err) {
        console.error(err)
        return { error: 'Failed to fetch reviews' }
    }
})

// Get single project for review (with user info and previous reviews)
admin.get('/reviews/:id', async ({ params, headers }) => {
    const user = await requireReviewer(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    try {
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
    } catch (err) {
        console.error(err);
        return { error: "Something went wrong while trying to get project" }
    }
})

// Submit a review
admin.post('/reviews/:id', async ({ params, body, headers }) => {
    try {
        const user = await requireReviewer(headers as Record<string, string>)
        if (!user) return { error: 'Unauthorized' }

        const { action, feedbackForAuthor, internalJustification, hoursOverride, tierOverride, userInternalNotes } = body as {
            action: 'approved' | 'denied' | 'permanently_rejected'
            feedbackForAuthor: string
            internalJustification?: string
            hoursOverride?: number
            tierOverride?: number
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

        // Validate hours override doesn't exceed project hours
        if (hoursOverride !== undefined && hoursOverride > (project[0].hours ?? 0)) {
            return { error: `Hours override (${hoursOverride}) cannot exceed project hours (${project[0].hours})` }
        }

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

        if (tierOverride !== undefined) {
            updateData.tierOverride = tierOverride
        }

        let scrapsAwarded = 0
        if (action === 'approved') {
            const hours = hoursOverride ?? project[0].hours ?? 0
            const tier = tierOverride ?? project[0].tier ?? 1
            scrapsAwarded = calculateScrapsFromHours(hours, tier)
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
    } catch (err) {
        console.error(err)
        return { error: 'Failed to submit review' }
    }
})

// Shop admin endpoints (admin only)
admin.get('/shop/items', async ({ headers }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) return { error: 'Unauthorized' }

        const items = await db
            .select()
            .from(shopItemsTable)
            .orderBy(desc(shopItemsTable.createdAt))

        return items
    } catch (err) {
        console.error(err)
        return { error: 'Failed to fetch shop items' }
    }
})

admin.post('/shop/items', async ({ headers, body, status }) => {
    const user = await requireAdmin(headers as Record<string, string>)
    if (!user) {
        return status(401, { error: 'Unauthorized' })
    }

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
        return status(400, { error: 'All fields are required' })
    }

    if (typeof price !== 'number' || price < 0) {
        return status(400, { error: 'Invalid price' })
    }

    if (baseProbability !== undefined && (typeof baseProbability !== 'number' || !Number.isInteger(baseProbability) || baseProbability < 0 || baseProbability > 100)) {
        return status(400, { error: 'Base probability must be an integer between 0 and 100' })
    }

    try {
        await db
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
            });

        return { success: true };
    } catch (err) {
        console.error(err);
        return status(500, { error: "Failed to create shop item" })
    }
})

admin.put('/shop/items/:id', async ({ params, headers, body, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

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

        if (baseProbability !== undefined && (typeof baseProbability !== 'number' || !Number.isInteger(baseProbability) || baseProbability < 0 || baseProbability > 100)) {
            return status(400, { error: 'Base probability must be an integer between 0 and 100' })
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

        if (!updated[0]) {
            return status(404, { error: 'Not found' })
        }
        return { success: true }
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to update shop item' })
    }
})

admin.delete('/shop/items/:id', async ({ params, headers, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        const itemId = parseInt(params.id)

        // Delete all related records first (cascade manually)
        await db.delete(shopHeartsTable).where(eq(shopHeartsTable.shopItemId, itemId))
        await db.delete(shopRollsTable).where(eq(shopRollsTable.shopItemId, itemId))
        await db.delete(refineryOrdersTable).where(eq(refineryOrdersTable.shopItemId, itemId))
        await db.delete(shopPenaltiesTable).where(eq(shopPenaltiesTable.shopItemId, itemId))
        await db.delete(shopOrdersTable).where(eq(shopOrdersTable.shopItemId, itemId))

        // Now delete the item itself
        await db.delete(shopItemsTable).where(eq(shopItemsTable.id, itemId))

        return { success: true }
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to delete shop item' })
    }
})

// News admin endpoints (admin only)
admin.get('/news', async ({ headers, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        const items = await db
            .select()
            .from(newsTable)
            .orderBy(desc(newsTable.createdAt))

        return items
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to fetch news' })
    }
})

admin.post('/news', async ({ headers, body, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        const { title, content, active } = body as {
            title: string
            content: string
            active?: boolean
        }

        if (!title?.trim() || !content?.trim()) {
            return status(400, { error: 'Title and content are required' })
        }

        const inserted = await db
            .insert(newsTable)
            .values({
                title: title.trim(),
                content: content.trim(),
                active: active ?? true
            })
            .returning({
                id: newsTable.id,
                title: newsTable.title,
                content: newsTable.content,
                active: newsTable.active,
                createdAt: newsTable.createdAt,
                updatedAt: newsTable.updatedAt
            })

        return inserted[0]
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to create news' })
    }
})

admin.put('/news/:id', async ({ params, headers, body, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

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
            .returning({
                id: newsTable.id,
                title: newsTable.title,
                content: newsTable.content,
                active: newsTable.active,
                createdAt: newsTable.createdAt,
                updatedAt: newsTable.updatedAt
            })

        if (!updated[0]) {
            return status(404, { error: 'Not found' })
        }
        return updated[0]
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to update news' })
    }
})

admin.delete('/news/:id', async ({ params, headers, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        await db
            .delete(newsTable)
            .where(eq(newsTable.id, parseInt(params.id)))

        return { success: true }
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to delete news' })
    }
})

admin.get('/orders', async ({ headers, query, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        const orderStatus = query.status as string | undefined

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

        if (orderStatus) {
            ordersQuery = ordersQuery.where(eq(shopOrdersTable.status, orderStatus)) as typeof ordersQuery
        }

        return await ordersQuery
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to fetch orders' })
    }
})

admin.patch('/orders/:id', async ({ params, body, headers, status }) => {
    try {
        const user = await requireAdmin(headers as Record<string, string>)
        if (!user) {
            return status(401, { error: 'Unauthorized' })
        }

        const { status: orderStatus, notes, isFulfilled } = body as { status?: string; notes?: string; isFulfilled?: boolean }

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
        if (orderStatus && !validStatuses.includes(orderStatus)) {
            return status(400, { error: 'Invalid status' })
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() }
        if (orderStatus) updateData.status = orderStatus
        if (notes !== undefined) updateData.notes = notes
        if (isFulfilled !== undefined) updateData.isFulfilled = isFulfilled

        const updated = await db
            .update(shopOrdersTable)
            .set(updateData)
            .where(eq(shopOrdersTable.id, parseInt(params.id)))
            .returning({
                id: shopOrdersTable.id,
                quantity: shopOrdersTable.quantity,
                pricePerItem: shopOrdersTable.pricePerItem,
                totalPrice: shopOrdersTable.totalPrice,
                status: shopOrdersTable.status,
                orderType: shopOrdersTable.orderType,
                notes: shopOrdersTable.notes,
                isFulfilled: shopOrdersTable.isFulfilled,
                shippingAddress: shopOrdersTable.shippingAddress,
                createdAt: shopOrdersTable.createdAt
            })

        if (!updated[0]) {
            return status(404, { error: 'Not found' })
        }
        return updated[0]
    } catch (err) {
        console.error(err)
        return status(500, { error: 'Failed to update order' })
    }
})

export default admin
