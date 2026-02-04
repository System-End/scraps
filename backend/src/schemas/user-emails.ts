import { pgTable, varchar, timestamp, serial } from 'drizzle-orm/pg-core'

export const userEmailsTable = pgTable('user_emails', {
	id: serial().primaryKey(),
	email: varchar().notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
})
