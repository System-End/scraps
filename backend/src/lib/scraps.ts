import { eq, sql } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { projectsTable } from '../schemas/projects'
import { shopOrdersTable, refinerySpendingHistoryTable } from '../schemas/shop'
import { userBonusesTable } from '../schemas/users'

export const PHI = (1 + Math.sqrt(5)) / 2
export const MULTIPLIER = 10
export const SCRAPS_PER_HOUR = PHI * MULTIPLIER
export const DOLLARS_PER_HOUR = 5
export const SCRAPS_PER_DOLLAR = SCRAPS_PER_HOUR / DOLLARS_PER_HOUR

export const TIER_MULTIPLIERS: Record<number, number> = {
	1: 0.8,
	2: 1.0,
	3: 1.25,
	4: 1.5
}

export interface ShopItemPricing {
	price: number
	baseProbability: number
	baseUpgradeCost: number
	costMultiplier: number
	boostAmount: number
}

export function calculateShopItemPricing(monetaryValue: number, stockCount: number): ShopItemPricing {
	const price = Math.round(monetaryValue * SCRAPS_PER_DOLLAR)
	
	// Rarity based on price and stock
	// Higher price = rarer, fewer stock = rarer
	// Base probability ranges from 1% (very rare) to 80% (common)
	const priceRarityFactor = Math.max(0, 1 - monetaryValue / 100) // $100+ = max rarity
	const stockRarityFactor = Math.min(1, stockCount / 20) // 20+ stock = common
	const baseProbability = Math.max(1, Math.min(80, Math.round((priceRarityFactor * 0.4 + stockRarityFactor * 0.6) * 80)))
	
	// Roll cost = price * (baseProbability / 100) - fixed, doesn't change with upgrades
	const rollCost = Math.max(1, Math.round(price * (baseProbability / 100)))
	
	// Total budget = 1.7x price
	// Upgrade budget = 1.7x price - rollCost
	const upgradeBudget = Math.max(0, price * 1.7 - rollCost)
	
	// Number of upgrades needed to go from baseProbability to 100%
	const probabilityGap = 100 - baseProbability
	
	// Boost amount: how much each upgrade increases probability
	// Target ~10-20 upgrades for expensive items, fewer for cheap
	const targetUpgrades = Math.max(5, Math.min(20, Math.ceil(monetaryValue / 5)))
	const boostAmount = Math.max(1, Math.round(probabilityGap / targetUpgrades))
	
	// Actual number of upgrades needed to reach 100%
	const actualUpgrades = Math.ceil(probabilityGap / boostAmount)
	
	// Calculate base cost and multiplier so sum of geometric series = upgradeBudget
	// Sum = base * (mult^n - 1) / (mult - 1)
	const costMultiplier = 110 // 1.10x per upgrade (stored as percentage)
	const multiplierDecimal = costMultiplier / 100
	
	// Calculate base cost from budget
	let baseUpgradeCost: number
	if (actualUpgrades <= 0 || upgradeBudget <= 0) {
		baseUpgradeCost = Math.round(price * 0.05) || 1
	} else {
		// Sum of geometric series: base * (r^n - 1) / (r - 1)
		const seriesSum = (Math.pow(multiplierDecimal, actualUpgrades) - 1) / (multiplierDecimal - 1)
		baseUpgradeCost = Math.max(1, Math.round(upgradeBudget / seriesSum))
	}
	
	return {
		price,
		baseProbability,
		baseUpgradeCost,
		costMultiplier,
		boostAmount
	}
}

export function calculateRollCost(basePrice: number, baseProbability: number): number {
	// Roll cost is fixed based on base probability, doesn't change with upgrades
	// This means rarer items (lower base probability) cost less per roll
	return Math.max(1, Math.round(basePrice * (baseProbability / 100)))
}

export function calculateScrapsFromHours(hours: number, tier: number = 1): number {
	const tierMultiplier = TIER_MULTIPLIERS[tier] ?? 1.0
	return Math.floor(hours * PHI * MULTIPLIER * tierMultiplier)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbOrTx = typeof db | PgTransaction<any, any, any>

export async function getUserScrapsBalance(userId: number, txOrDb: DbOrTx = db): Promise<{
	earned: number
	pending: number
	spent: number
	balance: number
}> {
	// Only count scraps that have been paid out (scrapsPaidAt IS NOT NULL)
	const earnedResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${projectsTable.scrapsAwarded}), 0)`
		})
		.from(projectsTable)
		.where(sql`${projectsTable.userId} = ${userId} AND ${projectsTable.scrapsPaidAt} IS NOT NULL`)

	// Pending scraps: awarded but not yet paid out (must be shipped & not deleted, matching payout criteria)
	const pendingResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${projectsTable.scrapsAwarded}), 0)`
		})
		.from(projectsTable)
		.where(sql`${projectsTable.userId} = ${userId} AND ${projectsTable.scrapsAwarded} > 0 AND ${projectsTable.scrapsPaidAt} IS NULL AND ${projectsTable.status} = 'shipped' AND (${projectsTable.deleted} = 0 OR ${projectsTable.deleted} IS NULL)`)

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

	// Calculate scraps spent on refinery upgrades (permanent history, only deleted on undo)
	const upgradeSpentResult = await txOrDb
		.select({
			total: sql<number>`COALESCE(SUM(${refinerySpendingHistoryTable.cost}), 0)`
		})
		.from(refinerySpendingHistoryTable)
		.where(eq(refinerySpendingHistoryTable.userId, userId))

	const projectEarned = Number(earnedResult[0]?.total) || 0
	const pending = Number(pendingResult[0]?.total) || 0
	const bonusEarned = Number(bonusResult[0]?.total) || 0
	const earned = projectEarned + bonusEarned
	const shopSpent = Number(spentResult[0]?.total) || 0
	const upgradeSpent = Number(upgradeSpentResult[0]?.total) || 0
	const spent = shopSpent + upgradeSpent
	const balance = earned - spent

	return { earned, pending, spent, balance }
}

export async function canAfford(userId: number, cost: number, txOrDb: DbOrTx = db): Promise<boolean> {
	if (cost < 0) return false
	if (!Number.isFinite(cost)) return false

	const { balance } = await getUserScrapsBalance(userId, txOrDb)

	if (!Number.isFinite(balance)) return false

	return balance >= cost
}
