import { Elysia } from "elysia"

const news = new Elysia({
    prefix: "/news"
})

// GET /news/latest - Get the latest news item
news.get("/latest", async () => {
    // TODO: Fetch latest news from database
    // const latestNews = await db.select().from(newsTable).orderBy(desc(newsTable.date)).limit(1)
    // return latestNews[0]

    // Dummy data for now
    return {
        id: 1,
        date: "jan 21, 2026",
        content: "remember to stay scrappy!"
    }
})

export default news
