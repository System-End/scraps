import { Elysia } from 'elysia'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { getUserFromSession } from '../lib/auth'

const projects = new Elysia({ prefix: '/projects' })

projects.get('/', async ({ headers }) => {
    const user = await getUserFromSession(headers as Record<string, string>)
    if (!user) return { error: 'Unauthorized' }

    return await db.select().from(projectsTable).where(eq(projectsTable.userId, user.id))
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

export default projects
