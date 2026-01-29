import { Elysia } from "elysia";

const news = new Elysia({
    prefix: "/news"
});

// GET /news - Get all news items
news.get("/", async () => {
    // TODO: Fetch news from database
    // const newsItems = await db.select().from(newsTable).orderBy(desc(newsTable.date))
    // return newsItems

    // Dummy data for now
    return [
        {
            id: 1,
            date: "jan 21, 2026",
            content: "remember to stay drafty!"
        },
        {
            id: 2,
            date: "jan 15, 2026",
            content: "new items added to the shop!"
        },
        {
            id: 3,
            date: "jan 10, 2026",
            content: "scraps is now live!"
        }
    ]
});

export default news;
