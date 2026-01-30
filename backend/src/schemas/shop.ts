import { integer, pgTable, varchar, timestamp, unique } from 'drizzle-orm/pg-core'
import { usersTable } from './users'

export const shopItemsTable = pgTable('shop_items', {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	name: varchar().notNull(),
	image: varchar().notNull(),
	description: varchar().notNull(),
	price: integer().notNull(),
	category: varchar().notNull(),
	count: integer().notNull().default(0),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
})

export const shopHeartsTable = pgTable('shop_hearts', {
	id: integer().primaryKey().generatedAlwaysAsIdentity(),
	userId: integer('user_id').notNull().references(() => usersTable.id),
	shopItemId: integer('shop_item_id').notNull().references(() => shopItemsTable.id),
	createdAt: timestamp('created_at').defaultNow().notNull()
}, (table) => [
	unique().on(table.userId, table.shopItemId)
])
