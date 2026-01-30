import { Elysia } from "elysia"

const items = new Elysia({
    prefix: "/items"
})

// GET /items - Get all shop items
items.get("/", async () => {
    // TODO: Fetch items from database
    // const shopItems = await db.select().from(itemsTable)
    // return shopItems

    // Dummy data for now
    return [
        {
            id: 1,
            name: "esp32",
            description: "a tiny microcontroller",
            image: "/hero.png",
            chance: 15,
            category: "hardware"
        },
        {
            id: 2,
            name: "arduino nano",
            description: "compact arduino board",
            image: "/hero.png",
            chance: 10,
            category: "hardware"
        },
        {
            id: 3,
            name: "breadboard",
            description: "for prototyping",
            image: "/hero.png",
            chance: 20,
            category: "hardware"
        },
        {
            id: 4,
            name: "resistor pack",
            description: "assorted resistors",
            image: "/hero.png",
            chance: 25,
            category: "hardware"
        },
        {
            id: 5,
            name: "vermont fudge",
            description: "delicious!",
            image: "/hero.png",
            chance: 5,
            category: "food"
        },
        {
            id: 6,
            name: "rare sticker",
            description: "limited edition",
            image: "/hero.png",
            chance: 8,
            category: "sticker"
        },
        {
            id: 7,
            name: "postcard",
            description: "from hq",
            image: "/hero.png",
            chance: 12,
            category: "misc"
        },
        {
            id: 8,
            name: "sensor kit",
            description: "various sensors",
            image: "/hero.png",
            chance: 5,
            category: "hardware"
        }
    ]
})

export default items
