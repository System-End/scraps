import { eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { shopOrdersTable, refineryOrdersTable } from '../schemas/shop'
import { userBonusesTable } from '../schemas/users'

export const PHI = (1 + Math.sqrt(5)) / 2
export const MULTIPLIER = 10

export function calculateScrapsFromHours(hours: number): number {
	return Math.floor(hours * PHI * MULTIPLIER)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | PgTransaction<any, any, any>

export async function getUserScrapsBalance(userId: number, txOrDb: DbOrTx = db): Promise<{
	earned: number
	spent: number
	balance: number
}> {
	const earnedResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${projectsTable.scrapsAwarded}), 0)`
		})
		.from(projectsTable)
		.where(eq(projectsTable.userId, userId))

	const bonusResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${userBonusesTable.amount}), 0)`
		})
		.from(userBonusesTable)
		.where(eq(userBonusesTable.userId, userId))

	const spentResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${shopOrdersTable.totalPrice}), 0)`
		})
		.from(shopOrdersTable)
		.where(eq(shopOrdersTable.userId, userId))

	// Calculate scraps spent on probability upgrades from refinery_orders
	const upgradeSpentResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${refineryOrdersTable.cost}), 0)`
		})
		.from(refineryOrdersTable)
		.where(eq(refineryOrdersTable.userId, userId))

	const projectEarned = Number(earnedResult[0]?.total) || 0
	const bonusEarned = Number(bonusResult[0]?.total) || 0
	const earned = projectEarned + bonusEarned
	const shopSpent = Number(spentResult[0]?.total) || 0
	const upgradeSpent = Number(upgradeSpentResult[0]?.total) || 0
	const spent = shopSpent + upgradeSpent
	const balance = earned - spent

	return { earned, spent, balance }
}

export async function canAfford(userId: number, cost: number, txOrDb: DbOrTx = db): Promise<boolean> {
	if (cost < 0) return false
	if (!Number.isFinite(cost)) return false

	const { balance } = await getUserScrapsBalance(userId, txOrDb)

	if (!Number.isFinite(balance)) return false

	return balance >= cost
}
