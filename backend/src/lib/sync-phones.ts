import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../db'
import { usersTable } from '../schemas/users'
import { shopOrdersTable } from '../schemas/shop'
import { fetchUserIdentity } from './auth'

export async function syncAllPhoneNumbers() {
	console.log('[SYNC-PHONES] Starting phone number sync...')

	try {
		const allUsers = await db
			.select({
				id: usersTable.id,
				username: usersTable.username,
				accessToken: usersTable.accessToken
			})
			.from(usersTable)

		let updated = 0
		let failed = 0
		let ordersUpdated = 0

		for (const u of allUsers) {
			if (!u.accessToken) {
				continue
			}

			const identity = await fetchUserIdentity(u.accessToken)
			if (!identity) {
				failed++
				continue
			}

			const phone = identity.identity.phone_number || null
			if (phone) {
				await db
					.update(usersTable)
					.set({ phone, updatedAt: new Date() })
					.where(eq(usersTable.id, u.id))
				updated++

				// Backfill phone on existing orders that don't have one
				const result = await db
					.update(shopOrdersTable)
					.set({ phone, updatedAt: new Date() })
					.where(and(
						eq(shopOrdersTable.userId, u.id),
						isNull(shopOrdersTable.phone)
					))
					.returning({ id: shopOrdersTable.id })
				ordersUpdated += result.length
			}
		}

		console.log(`[SYNC-PHONES] Done. Updated ${updated} of ${allUsers.length} users, ${ordersUpdated} orders backfilled (${failed} failed)`)
		return { total: allUsers.length, updated, ordersUpdated, failed }
	} catch (err) {
		console.error('[SYNC-PHONES] Error syncing phone numbers:', err)
	}
}
