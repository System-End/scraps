import { Elysia } from 'elysia'
import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { reviewsTable } from '../schemas/reviews'
import { getUserFromSession } from '../lib/auth'

const projects = new Elysia({ prefix: '/projects' })

projects.get('/', async ({ headers, query }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const page = parseInt(query.page as string) || 1
    const limit = Math.min(parseInt(query.limit as string) || 20, 100)
    const offset = (page - 1) * limit

    const [projectsList, countResult] = await Promise.all([
        db.select().from(projectsTable)
            .where(eq(projectsTable.userId, user.id))
            .orderBy(desc(projectsTable.updatedAt))
            .limit(limit)
            .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(projectsTable)
            .where(eq(projectsTable.userId, user.id))
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
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .limit(1)

    return project[0] || { error: 'Not found' }
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
        hours?: number
    }

    const newProject = await db
        .insert(projectsTable)
        .values({
            userId: user.id,
            name: data.name,
            description: data.description,
            image: data.image || null,
            githubUrl: data.githubUrl || null,
            hackatimeProject: data.hackatimeProject || null,
            hours: data.hours || 0
        })
        .returning()

    return newProject[0]
})

projects.put('/:id', async ({ params, body, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    const data = body as {
        name?: string
        description?: string
        image?: string | null
        githubUrl?: string | null
        hackatimeProject?: string | null
        hours?: number
    }

    const updated = await db
        .update(projectsTable)
        .set({
            name: data.name,
            description: data.description,
            image: data.image,
            githubUrl: data.githubUrl,
            hackatimeProject: data.hackatimeProject,
            hours: data.hours,
            updatedAt: new Date()
        })
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .returning()

    return updated[0] || { error: 'Not found' }
})

projects.delete("/:id", async ({ params, headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: "Unauthorized" }

    const deleted = await db
        .delete(projectsTable)
        .where(and(eq(projectsTable.id, parseInt(params.id)), eq(projectsTable.userId, user.id)))
        .returning()

    return deleted.length ? { success: true } : { error: "Not found" }
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

    const updated = await db
        .update(projectsTable)
        .set({ status: 'waiting_for_review', updatedAt: new Date() })
        .where(eq(projectsTable.id, parseInt(params.id)))
        .returning()

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
            action: reviewsTable.action,
            feedbackForAuthor: reviewsTable.feedbackForAuthor,
            createdAt: reviewsTable.createdAt
        })
        .from(reviewsTable)
        .where(eq(reviewsTable.projectId, parseInt(params.id)))

    return reviews
})

export default projects
