import { Elysia } from 'elysia'
import { eq, sql, and, desc, isNull } from 'drizzle-orm'
import { db } from '../db'
import { shopItemsTable, shopHeartsTable, shopOrdersTable, shopRollsTable, refineryOrdersTable, shopPenaltiesTable } from '../schemas/shop'
import { usersTable } from '../schemas/users'
import { getUserFromSession } from '../lib/auth'
import { getUserScrapsBalance, canAfford } from '../lib/scraps'

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
			baseProbability: shopItemsTable.baseProbability,
			baseUpgradeCost: shopItemsTable.baseUpgradeCost,
			costMultiplier: shopItemsTable.costMultiplier,
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

		const userBoosts = await db
			.select({
				shopItemId: refineryOrdersTable.shopItemId,
				boostPercent: sql<number>`COALESCE(SUM(${refineryOrdersTable.boostAmount}), 0)`
			})
			.from(refineryOrdersTable)
			.where(eq(refineryOrdersTable.userId, user.id))
			.groupBy(refineryOrdersTable.shopItemId)

		const userPenalties = await db
			.select({
				shopItemId: shopPenaltiesTable.shopItemId,
				probabilityMultiplier: shopPenaltiesTable.probabilityMultiplier
			})
			.from(shopPenaltiesTable)
			.where(eq(shopPenaltiesTable.userId, user.id))

		const heartedIds = new Set(userHearts.map(h => h.shopItemId))
		const boostMap = new Map(userBoosts.map(b => [b.shopItemId, Number(b.boostPercent)]))
		const penaltyMap = new Map(userPenalties.map(p => [p.shopItemId, p.probabilityMultiplier]))

		return items.map(item => {
			const userBoostPercent = boostMap.get(item.id) ?? 0
			const penaltyMultiplier = penaltyMap.get(item.id) ?? 100
			const adjustedBaseProbability = Math.floor(item.baseProbability * penaltyMultiplier / 100)
			return {
				...item,
				heartCount: Number(item.heartCount) || 0,
				userBoostPercent,
				adjustedBaseProbability,
				effectiveProbability: Math.min(adjustedBaseProbability + userBoostPercent, 100),
				userHearted: heartedIds.has(item.id)
			}
		})
	}

	return items.map(item => ({
		...item,
		heartCount: Number(item.heartCount) || 0,
		userBoostPercent: 0,
		effectiveProbability: Math.min(item.baseProbability, 100),
		userHearted: false
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
			baseProbability: shopItemsTable.baseProbability,
			baseUpgradeCost: shopItemsTable.baseUpgradeCost,
			costMultiplier: shopItemsTable.costMultiplier,
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
	let userBoostPercent = 0
	let penaltyMultiplier = 100

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

		const boost = await db
			.select({
				boostPercent: sql<number>`COALESCE(SUM(${refineryOrdersTable.boostAmount}), 0)`
			})
			.from(refineryOrdersTable)
			.where(and(
				eq(refineryOrdersTable.userId, user.id),
				eq(refineryOrdersTable.shopItemId, itemId)
			))

		userBoostPercent = boost.length > 0 ? Number(boost[0].boostPercent) : 0

		const penalty = await db
			.select({ probabilityMultiplier: shopPenaltiesTable.probabilityMultiplier })
			.from(shopPenaltiesTable)
			.where(and(
				eq(shopPenaltiesTable.userId, user.id),
				eq(shopPenaltiesTable.shopItemId, itemId)
			))
			.limit(1)

		penaltyMultiplier = penalty.length > 0 ? penalty[0].probabilityMultiplier : 100
	}

	const adjustedBaseProbability = Math.floor(item.baseProbability * penaltyMultiplier / 100)

	return {
		...item,
		heartCount: Number(item.heartCount) || 0,
		userBoostPercent,
		adjustedBaseProbability,
		effectiveProbability: Math.min(adjustedBaseProbability + userBoostPercent, 100),
		userHearted: hearted
	}
})

shop.post('/items/:id/heart', async ({ params, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const item = await db
		.select()
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (item.length === 0) {
		return { error: 'Item not found' }
	}

	const deleted = await db
		.delete(shopHeartsTable)
		.where(and(
			eq(shopHeartsTable.userId, user.id),
			eq(shopHeartsTable.shopItemId, itemId)
		))
		.returning({ userId: shopHeartsTable.userId })

	if (deleted.length > 0) {
		return { hearted: false }
	}

	await db
		.insert(shopHeartsTable)
		.values({
			userId: user.id,
			shopItemId: itemId
		})
		.onConflictDoNothing()

	return { hearted: true }
})

shop.get('/categories', async () => {
	const result = await db
		.selectDistinct({ category: shopItemsTable.category })
		.from(shopItemsTable)

	return result.map(r => r.category)
})

shop.get('/balance', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	return await getUserScrapsBalance(user.id)
})

shop.post('/items/:id/purchase', async ({ params, body, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const { quantity = 1, shippingAddress } = body as { quantity?: number; shippingAddress?: string }

	if (quantity < 1 || !Number.isInteger(quantity)) {
		return { error: 'Invalid quantity' }
	}

	const items = await db
		.select()
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (items.length === 0) {
		return { error: 'Item not found' }
	}

	const item = items[0]

	if (item.count < quantity) {
		return { error: 'Not enough stock available' }
	}

	const totalPrice = item.price * quantity

	const affordable = await canAfford(user.id, totalPrice)
	if (!affordable) {
		const { balance } = await getUserScrapsBalance(user.id)
		return { error: 'Insufficient scraps', required: totalPrice, available: balance }
	}

	const order = await db.transaction(async (tx) => {
		const currentItem = await tx
			.select()
			.from(shopItemsTable)
			.where(eq(shopItemsTable.id, itemId))
			.limit(1)

		if (currentItem.length === 0 || currentItem[0].count < quantity) {
			throw new Error('Not enough stock')
		}

		await tx
			.update(shopItemsTable)
			.set({
				count: currentItem[0].count - quantity,
				updatedAt: new Date()
			})
			.where(eq(shopItemsTable.id, itemId))

		const newOrder = await tx
			.insert(shopOrdersTable)
			.values({
				userId: user.id,
				shopItemId: itemId,
				quantity,
				pricePerItem: item.price,
				totalPrice,
				shippingAddress: shippingAddress || null,
				status: 'pending'
			})
			.returning()

		return newOrder[0]
	})

	return {
		success: true,
		order: {
			id: order.id,
			itemName: item.name,
			quantity: order.quantity,
			totalPrice: order.totalPrice,
			status: order.status
		}
	}
})

shop.get('/orders', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const orders = await db
		.select({
			id: shopOrdersTable.id,
			quantity: shopOrdersTable.quantity,
			pricePerItem: shopOrdersTable.pricePerItem,
			totalPrice: shopOrdersTable.totalPrice,
			status: shopOrdersTable.status,
			createdAt: shopOrdersTable.createdAt,
			itemId: shopItemsTable.id,
			itemName: shopItemsTable.name,
			itemImage: shopItemsTable.image
		})
		.from(shopOrdersTable)
		.innerJoin(shopItemsTable, eq(shopOrdersTable.shopItemId, shopItemsTable.id))
		.where(eq(shopOrdersTable.userId, user.id))
		.orderBy(desc(shopOrdersTable.createdAt))

	return orders
})

shop.post('/items/:id/try-luck', async ({ params, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const items = await db
		.select()
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (items.length === 0) {
		return { error: 'Item not found' }
	}

	const item = items[0]

	if (item.count < 1) {
		return { error: 'Out of stock' }
	}

	const boostResult = await db
		.select({
			boostPercent: sql<number>`COALESCE(SUM(${refineryOrdersTable.boostAmount}), 0)`
		})
		.from(refineryOrdersTable)
		.where(and(
			eq(refineryOrdersTable.userId, user.id),
			eq(refineryOrdersTable.shopItemId, itemId)
		))

	const penaltyResult = await db
		.select({ probabilityMultiplier: shopPenaltiesTable.probabilityMultiplier })
		.from(shopPenaltiesTable)
		.where(and(
			eq(shopPenaltiesTable.userId, user.id),
			eq(shopPenaltiesTable.shopItemId, itemId)
		))
		.limit(1)

	const boostPercent = boostResult.length > 0 ? Number(boostResult[0].boostPercent) : 0
	const penaltyMultiplier = penaltyResult.length > 0 ? penaltyResult[0].probabilityMultiplier : 100
	const adjustedBaseProbability = Math.floor(item.baseProbability * penaltyMultiplier / 100)
	const effectiveProbability = Math.min(adjustedBaseProbability + boostPercent, 100)

	const affordable = await canAfford(user.id, item.price)
	if (!affordable) {
		const { balance } = await getUserScrapsBalance(user.id)
		return { error: 'Insufficient scraps', required: item.price, available: balance }
	}

	const rolled = Math.floor(Math.random() * 100) + 1
	const won = rolled <= effectiveProbability

	// Record the roll
	await db.insert(shopRollsTable).values({
		userId: user.id,
		shopItemId: itemId,
		rolled,
		threshold: effectiveProbability,
		won
	})

	if (won) {
		const order = await db.transaction(async (tx) => {
			const currentItem = await tx
				.select()
				.from(shopItemsTable)
				.where(eq(shopItemsTable.id, itemId))
				.limit(1)

			if (currentItem.length === 0 || currentItem[0].count < 1) {
				throw new Error('Out of stock')
			}

			await tx
				.update(shopItemsTable)
				.set({
					count: currentItem[0].count - 1,
					updatedAt: new Date()
				})
				.where(eq(shopItemsTable.id, itemId))

			const newOrder = await tx
				.insert(shopOrdersTable)
				.values({
					userId: user.id,
					shopItemId: itemId,
					quantity: 1,
					pricePerItem: item.price,
					totalPrice: item.price,
					shippingAddress: null,
					status: 'pending',
					orderType: 'luck_win'
				})
				.returning()

			await tx
				.delete(refineryOrdersTable)
				.where(and(
					eq(refineryOrdersTable.userId, user.id),
					eq(refineryOrdersTable.shopItemId, itemId)
				))

			const existingPenalty = await tx
				.select({ probabilityMultiplier: shopPenaltiesTable.probabilityMultiplier })
				.from(shopPenaltiesTable)
				.where(and(
					eq(shopPenaltiesTable.userId, user.id),
					eq(shopPenaltiesTable.shopItemId, itemId)
				))
				.limit(1)

			if (existingPenalty.length > 0) {
				const newMultiplier = Math.max(1, Math.floor(existingPenalty[0].probabilityMultiplier / 2))
				await tx
					.update(shopPenaltiesTable)
					.set({
						probabilityMultiplier: newMultiplier,
						updatedAt: new Date()
					})
					.where(and(
						eq(shopPenaltiesTable.userId, user.id),
						eq(shopPenaltiesTable.shopItemId, itemId)
					))
			} else {
				await tx
					.insert(shopPenaltiesTable)
					.values({
						userId: user.id,
						shopItemId: itemId,
						probabilityMultiplier: 50
					})
			}

			return newOrder[0]
		})

		return { success: true, won: true, orderId: order.id, effectiveProbability, rolled, refineryReset: true, probabilityHalved: true }
	}

	return { success: true, won: false, effectiveProbability, rolled }
})

shop.post('/items/:id/upgrade-probability', async ({ params, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const items = await db
		.select()
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (items.length === 0) {
		return { error: 'Item not found' }
	}

	const item = items[0]

	const boostResult = await db
		.select({
			boostPercent: sql<number>`COALESCE(SUM(${refineryOrdersTable.boostAmount}), 0)`
		})
		.from(refineryOrdersTable)
		.where(and(
			eq(refineryOrdersTable.userId, user.id),
			eq(refineryOrdersTable.shopItemId, itemId)
		))

	const currentBoost = boostResult.length > 0 ? Number(boostResult[0].boostPercent) : 0

	const penaltyResult = await db
		.select({ probabilityMultiplier: shopPenaltiesTable.probabilityMultiplier })
		.from(shopPenaltiesTable)
		.where(and(
			eq(shopPenaltiesTable.userId, user.id),
			eq(shopPenaltiesTable.shopItemId, itemId)
		))
		.limit(1)

	const penaltyMultiplier = penaltyResult.length > 0 ? penaltyResult[0].probabilityMultiplier : 100
	const adjustedBaseProbability = Math.floor(item.baseProbability * penaltyMultiplier / 100)

	const maxBoost = 100 - adjustedBaseProbability
	if (currentBoost >= maxBoost) {
		return { error: 'Already at maximum probability' }
	}

	const cost = Math.floor(item.baseUpgradeCost * Math.pow(item.costMultiplier / 100, currentBoost))

	const affordable = await canAfford(user.id, cost)
	if (!affordable) {
		const { balance } = await getUserScrapsBalance(user.id)
		return { error: 'Insufficient scraps', required: cost, available: balance }
	}

	const newBoost = currentBoost + 1

	// Record the refinery order
	await db.insert(refineryOrdersTable).values({
		userId: user.id,
		shopItemId: itemId,
		cost,
		boostAmount: 1
	})

	const nextCost = newBoost >= maxBoost
		? null
		: Math.floor(item.baseUpgradeCost * Math.pow(item.costMultiplier / 100, newBoost))

	return {
		boostPercent: newBoost,
		nextCost,
		effectiveProbability: Math.min(adjustedBaseProbability + newBoost, 100)
	}
})

shop.get('/items/:id/leaderboard', async ({ params }) => {
	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const items = await db
		.select()
		.from(shopItemsTable)
		.where(eq(shopItemsTable.id, itemId))
		.limit(1)

	if (items.length === 0) {
		return { error: 'Item not found' }
	}

	const item = items[0]

	const leaderboard = await db
		.select({
			userId: refineryOrdersTable.userId,
			username: usersTable.username,
			avatar: usersTable.avatar,
			boostPercent: sql<number>`COALESCE(SUM(${refineryOrdersTable.boostAmount}), 0)`
		})
		.from(refineryOrdersTable)
		.innerJoin(usersTable, eq(refineryOrdersTable.userId, usersTable.id))
		.where(eq(refineryOrdersTable.shopItemId, itemId))
		.groupBy(refineryOrdersTable.userId, usersTable.username, usersTable.avatar)
		.orderBy(desc(sql`SUM(${refineryOrdersTable.boostAmount})`))
		.limit(20)

	return leaderboard.map(entry => ({
		...entry,
		boostPercent: Number(entry.boostPercent),
		effectiveProbability: Math.min(item.baseProbability + Number(entry.boostPercent), 100)
	}))
})

shop.get('/items/:id/buyers', async ({ params }) => {
	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const buyers = await db
		.select({
			userId: shopOrdersTable.userId,
			username: usersTable.username,
			avatar: usersTable.avatar,
			quantity: shopOrdersTable.quantity,
			createdAt: shopOrdersTable.createdAt
		})
		.from(shopOrdersTable)
		.innerJoin(usersTable, eq(shopOrdersTable.userId, usersTable.id))
		.where(eq(shopOrdersTable.shopItemId, itemId))
		.orderBy(desc(shopOrdersTable.createdAt))
		.limit(20)

	return buyers
})

shop.get('/items/:id/hearts', async ({ params }) => {
	const itemId = parseInt(params.id)
	if (!Number.isInteger(itemId)) {
		return { error: 'Invalid item id' }
	}

	const hearts = await db
		.select({
			userId: shopHeartsTable.userId,
			username: usersTable.username,
			avatar: usersTable.avatar,
			createdAt: shopHeartsTable.createdAt
		})
		.from(shopHeartsTable)
		.innerJoin(usersTable, eq(shopHeartsTable.userId, usersTable.id))
		.where(eq(shopHeartsTable.shopItemId, itemId))
		.orderBy(desc(shopHeartsTable.createdAt))
		.limit(20)

	return hearts
})

shop.get('/addresses', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const userData = await db
		.select({ accessToken: usersTable.accessToken })
		.from(usersTable)
		.where(eq(usersTable.id, user.id))
		.limit(1)

	if (userData.length === 0 || !userData[0].accessToken) {
		return []
	}

	try {
		const response = await fetch('https://identity.hackclub.com/api/v1/me', {
			headers: {
				Authorization: `Bearer ${userData[0].accessToken}`
			}
		})

		if (!response.ok) {
			return []
		}

		const data = await response.json() as {
			identity?: {
				addresses?: Array<{
					id: string
					first_name: string
					last_name: string
					line_1: string
					line_2: string
					city: string
					state: string
					postal_code: string
					country: string
					phone_number: string
					primary: boolean
				}>
			}
		}

		return data.identity?.addresses ?? []
	} catch {
		return []
	}
})

shop.get('/orders/pending-address', async ({ headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const orders = await db
		.select({
			id: shopOrdersTable.id,
			quantity: shopOrdersTable.quantity,
			pricePerItem: shopOrdersTable.pricePerItem,
			totalPrice: shopOrdersTable.totalPrice,
			status: shopOrdersTable.status,
			orderType: shopOrdersTable.orderType,
			createdAt: shopOrdersTable.createdAt,
			itemId: shopItemsTable.id,
			itemName: shopItemsTable.name,
			itemImage: shopItemsTable.image
		})
		.from(shopOrdersTable)
		.innerJoin(shopItemsTable, eq(shopOrdersTable.shopItemId, shopItemsTable.id))
		.where(and(
			eq(shopOrdersTable.userId, user.id),
			isNull(shopOrdersTable.shippingAddress)
		))
		.orderBy(desc(shopOrdersTable.createdAt))

	return orders
})

shop.post('/orders/:id/address', async ({ params, body, headers }) => {
	const user = await getUserFromSession(headers as Record<string, string>)
	if (!user) {
		return { error: 'Unauthorized' }
	}

	const orderId = parseInt(params.id)
	if (!Number.isInteger(orderId)) {
		return { error: 'Invalid order id' }
	}

	const { shippingAddress } = body as { shippingAddress?: string }
	if (!shippingAddress) {
		return { error: 'Shipping address is required' }
	}

	const orders = await db
		.select()
		.from(shopOrdersTable)
		.where(eq(shopOrdersTable.id, orderId))
		.limit(1)

	if (orders.length === 0) {
		return { error: 'Order not found' }
	}

	if (orders[0].userId !== user.id) {
		return { error: 'Unauthorized' }
	}

	await db
		.update(shopOrdersTable)
		.set({
			shippingAddress,
			updatedAt: new Date()
		})
		.where(eq(shopOrdersTable.id, orderId))

	return { success: true }
})

export default shop
