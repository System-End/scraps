import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import projects from './routes/projects'
import news from './routes/news'
import items from './routes/items'
import authRoutes from './routes/auth'
import user from './routes/user'
import shop from './routes/shop'
import leaderboard from './routes/leaderboard'
import hackatime from './routes/hackatime'
import upload from './routes/upload'

const api = new Elysia({ prefix: '/api' })
    .use(authRoutes)
    .use(projects)
    .use(news)
    .use(items)
    .use(user)
    .use(shop)
    .use(leaderboard)
    .use(hackatime)
    .use(upload)
    .get("/", () => "if you dm @notaroomba abt finding this you may get cool stickers")

const app = new Elysia()
    .use(cors({
        origin: ["http://localhost:5173", "http://localhost:3000"],
        credentials: true
    }))
    .use(api)
    .listen(3000)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
