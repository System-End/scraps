import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'

const db = drizzle(process.env.DATABASE_URL!)

await db.execute(sql`DROP TABLE IF EXISTS projects CASCADE`)
console.log('Dropped projects table')
