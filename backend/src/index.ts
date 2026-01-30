import { Elysia } from "elysia"
import projects from "./routes/projects"
import news from "./routes/news"
import items from "./routes/items"

const app = new Elysia()
    .use(projects)
    .use(news)
    .use(items)
    .get("/", () => "Hello Elysia")
    .listen(3000)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
