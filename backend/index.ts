import { Elysia } from 'elysia'
import projects from './routes/projects'
import news from './routes/news'

const app = new Elysia()
    .use(projects)
    .use(news)
    .listen(3000)

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`)

export default app