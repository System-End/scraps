import { Elysia } from 'elysia'
import { eq, inArray } from 'drizzle-orm'
import { getUserFromSession, checkUserEligibility } from '../lib/auth'
import { db } from '../db'
import { usersTable } from '../schemas/users'
import { projectsTable } from '../schemas/projects'
import { shopHeartsTable, shopItemsTable } from '../schemas/shop'

const user = new Elysia({ prefix: '/user' })

user.get('/me', async ({ headers }) => {
    const userData = await getUserFromSession(headers as Record<string, string>)
    if (!userData) return { error: 'Unauthorized' }

    let yswsEligible = false
    let verificationStatus = 'unknown'

    if (userData.accessToken) {
        const eligibility = await checkUserEligibility(userData.accessToken)
        if (eligibility) {
            yswsEligible = eligibility.yswsEligible
            verificationStatus = eligibility.verificationStatus
        }
    }

    return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        slackId: userData.slackId,
        scraps: userData.scraps,
        yswsEligible,
        verificationStatus
    }
})

// Public profile - anyone logged in can view
user.get('/profile/:id', async ({ params, headers }) => {
    const currentUser = await getUserFromSession(headers as Record<string, string>)
    if (!currentUser) return { error: 'Unauthorized' }

    const targetUser = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, parseInt(params.id)))
        .limit(1)

    if (!targetUser[0]) return { error: 'User not found' }

    const allProjects = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.userId, parseInt(params.id)))

    // Only show shipped, in_progress, and waiting_for_review projects to other users, exclude deleted
    const visibleProjects = allProjects.filter(p => !p.deleted && (p.status === 'shipped' || p.status === 'in_progress' || p.status === 'waiting_for_review'))
    const shippedCount = allProjects.filter(p => !p.deleted && p.status === 'shipped').length
    const inProgressCount = allProjects.filter(p => !p.deleted && (p.status === 'in_progress' || p.status === 'waiting_for_review')).length
    const shippedHours = allProjects
        .filter(p => !p.deleted && p.status === 'shipped')
        .reduce((sum, p) => sum + (p.hoursOverride ?? p.hours ?? 0), 0)
    const inProgressHours = allProjects
        .filter(p => !p.deleted && (p.status === 'in_progress' || p.status === 'waiting_for_review'))
        .reduce((sum, p) => sum + (p.hoursOverride ?? p.hours ?? 0), 0)
    const totalHours = shippedHours + inProgressHours

    // Get user's hearted shop items
    const userHearts = await db
        .select({ shopItemId: shopHeartsTable.shopItemId })
        .from(shopHeartsTable)
        .where(eq(shopHeartsTable.userId, parseInt(params.id)))

    const heartedItemIds = userHearts.map(h => h.shopItemId)
    let heartedItems: { id: number; name: string; image: string; price: number }[] = []
    if (heartedItemIds.length > 0) {
        heartedItems = await db
            .select({
                id: shopItemsTable.id,
                name: shopItemsTable.name,
                image: shopItemsTable.image,
                price: shopItemsTable.price
            })
            .from(shopItemsTable)
            .where(inArray(shopItemsTable.id, heartedItemIds))
    }

    return {
        user: {
            id: targetUser[0].id,
            username: targetUser[0].username,
            avatar: targetUser[0].avatar,
            scraps: targetUser[0].scraps,
            createdAt: targetUser[0].createdAt
        },
        projects: visibleProjects.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            image: p.image,
            githubUrl: p.githubUrl,
            hours: p.hoursOverride ?? p.hours,
            status: p.status,
            createdAt: p.createdAt
        })),
        heartedItems,
        stats: {
            projectCount: shippedCount,
            inProgressCount,
            totalHours
        }
    }
})

export default user
