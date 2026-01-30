import { Elysia } from 'elysia'
import { eq, sql, and } from 'drizzle-orm'
import { db } from '../db'
import { shopItemsTable, shopHeartsTable } from '../schemas/shop'
import { getUserFromSession } from '../lib/auth'

const shop = new Elysia({ prefix: '/shop' })

shop.get('/items', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)

	const items = await db
		.select({
			id: shopItemsTable.id,
			name: shopItemsTable.name,
			image: shopItemsTable.image,
			description: shopItemsTable.description,
			price: shopItemsTable.price,
			category: shopItemsTable.category,
			count: shopItemsTable.count,
			createdAt: shopItemsTable.createdAt,
			updatedAt: shopItemsTable.updatedAt,
			heartCount: sql<number>`(SELECT COUNT(*) FROM shop_hearts WHERE shop_item_id = ${shopItemsTable.id})`.as('heart_count')
		})
		.from(shopItemsTable)

	if (user) {
		const userHearts = await db
			.select({ shopItemId: shopHeartsTable.shopItemId })
			.from(shopHeartsTable)
			.where(eq(shopHeartsTable.userId, user.id))

		const heartedIds = new Set(userHearts.map(h => h.shopItemId))

		return items.map(item => ({
			...item,
			hearted: heartedIds.has(item.id)
		}))
	}

	return items.map(item => ({
		...item,
		hearted: false
	}))
})

shop.get('/items/:id', async ({ params, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	const itemId = parseInt(params.id)

	const items = await db
		.select({
			id: shopItemsTable.id,
			name: shopItemsTable.name,
			image: shopItemsTable.image,
			description: shopItemsTable.description,
			price: shopItemsTable.price,
			category: shopItemsTable.category,
			count: shopItemsTable.count,
			createdAt: shopItemsTable.createdAt,
			updatedAt: shopItemsTable.updatedAt,
			heartCount: sql<number>`(SELECT COUNT(*) FROM shop_hearts WHERE shop_item_id = ${shopItemsTable.id})`.as('heart_count')
		})
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (items.length === 0) {
		return { error: 'Item not found' }
	}

	const item = items[0]
	let hearted = false

	if (user) {
		const heart = await db
			.select()
			.from(shopHeartsTable)
			.where(and(
				eq(shopHeartsTable.userId, user.id),
				eq(shopHeartsTable.shopItemId, itemId)
			))
			.limit(1)

		hearted = heart.length > 0
	}

	return { ...item, hearted }
})

shop.post('/items/:id/heart', async ({ params, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const itemId = parseInt(params.id)

	const item = await db
		.select()
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (item.length === 0) {
		return { error: 'Item not found' }
	}

	const existingHeart = await db
		.select()
		.from(shopHeartsTable)
		.where(and(
			eq(shopHeartsTable.userId, user.id),
			eq(shopHeartsTable.shopItemId, itemId)
		))
		.limit(1)

	if (existingHeart.length > 0) {
		await db
			.delete(shopHeartsTable)
			.where(and(
				eq(shopHeartsTable.userId, user.id),
				eq(shopHeartsTable.shopItemId, itemId)
			))
		return { hearted: false }
	} else {
		await db
			.insert(shopHeartsTable)
			.values({
				userId: user.id,
				shopItemId: itemId
			})
		return { hearted: true }
	}
})

shop.get('/categories', async () => {
	const result = await db
		.selectDistinct({ category: shopItemsTable.category })
		.from(shopItemsTable)

	return result.map(r => r.category)
})

export default shop
