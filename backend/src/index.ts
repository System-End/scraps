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
import admin from './routes/admin'

const api = new Elysia()
    .use(authRoutes)
    .use(projects)
    .use(news)
    .use(items)
    .use(user)
    .use(shop)
    .use(leaderboard)
    .use(hackatime)
    .use(upload)
    .use(admin)
    .get("/", () => "if you dm @notaroomba abt finding this you may get cool stickers")

const app = new Elysia()
    .use(cors({
        origin: [process.env.FRONTEND_URL as string],
        credentials: true
    }))
    .use(api)
    .listen(3000)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
