import { Elysia } from "elysia"

const projects = new Elysia({
    prefix: "/projects"
})

// GET /projects - Get all projects for the authenticated user
projects.get("/", async ({ headers }) => {
    // TODO: Get user from auth header and fetch their projects from database
    // const userId = await getUserFromToken(headers.authorization)
    // const userProjects = await db.select().from(projectsTable).where(eq(projectsTable.userId, userId))
    // return userProjects

    // Dummy data for now
    return [
        {
            id: 1,
            userId: 1,
            name: "Blueprint",
            description: "A hackathon project for AMD",
            imageUrl: "/hero.png",
            githubUrl: "https://github.com/hackclub/blueprint",
            hours: 24,
            hackatimeUrl: "https://hackatime.hackclub.com/projects/blueprint"
        },
        {
            id: 2,
            userId: 1,
            name: "Flavortown",
            description: "A food discovery app",
            imageUrl: "/hero.png",
            githubUrl: "https://github.com/hackclub/flavortown",
            hours: 18,
            hackatimeUrl: "https://hackatime.hackclub.com/projects/flavortown"
        }
    ]
})

// PUT /projects/:id - Update a project
projects.put("/:id", async ({ params, body }) => {
    // TODO: Validate user owns this project and update in database
    // const project = await db.update(projectsTable).set(body).where(eq(projectsTable.id, params.id)).returning()
    // return project

    return { success: true, ...body }
})

// POST /projects - Create a new project
projects.post("/", async ({ body }) => {
    // TODO: Get user from auth and create project in database
    // const project = await db.insert(projectsTable).values({ ...body, userId }).returning()
    // return project

    return { success: true, id: Date.now(), ...body }
})

export default projects
