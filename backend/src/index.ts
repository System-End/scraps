import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { config } from './config'
import projects from './routes/projects'
import news from './routes/news'
import authRoutes from './routes/auth'
import user from './routes/user'
import shop from './routes/shop'
import leaderboard from './routes/leaderboard'
import hackatime from './routes/hackatime'
import upload from './routes/upload'
import admin from './routes/admin'
import { startHackatimeSync } from './lib/hackatime-sync'
import { startAirtableSync } from './lib/airtable-sync'

const api = new Elysia()
    .use(authRoutes)
    .use(projects)
    .use(news)
    .use(user)
    .use(shop)
    .use(leaderboard)
    .use(hackatime)
    .use(upload)
    .use(admin)
    .get("/", () => "if you dm @notaroomba abt finding this you may get cool stickers")

const app = new Elysia()
    .use(cors({
        origin: [config.frontendUrl],
        credentials: true
    }))
    .use(api)
    .listen(config.port)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)

// Start background hackatime sync
startHackatimeSync()

// Start background airtable sync
startAirtableSync()
