import { db } from '../db'
import { shopItemsTable } from '../schemas/shop'
import { eq } from 'drizzle-orm'
import { calculateShopItemPricing, SCRAPS_PER_DOLLAR } from './scraps'

export async function updateShopItemPricing() {
	try {
		const items = await db
			.select({
				id: shopItemsTable.id,
				name: shopItemsTable.name,
				price: shopItemsTable.price,
				count: shopItemsTable.count
			})
			.from(shopItemsTable)

		let updated = 0
		for (const item of items) {
			const monetaryValue = item.price / SCRAPS_PER_DOLLAR
			const pricing = calculateShopItemPricing(monetaryValue, item.count)

			await db
				.update(shopItemsTable)
				.set({
					baseProbability: pricing.baseProbability,
					baseUpgradeCost: pricing.baseUpgradeCost,
					costMultiplier: pricing.costMultiplier,
					boostAmount: pricing.boostAmount,
					updatedAt: new Date()
				})
				.where(eq(shopItemsTable.id, item.id))

			updated++
		}

		console.log(`[STARTUP] Updated pricing for ${updated} shop items`)
	} catch (err) {
		console.error('[STARTUP] Failed to update shop item pricing:', err)
	}
}
