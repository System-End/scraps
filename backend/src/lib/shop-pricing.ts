import { db } from "../db";
import { shopItemsTable } from "../schemas/shop";
import { eq } from "drizzle-orm";
import {
  calculateShopItemPricing,
  SCRAPS_PER_DOLLAR,
  PHI,
  MULTIPLIER,
} from "./scraps";

// 1 hour of work ≈ $4 grant value
// 1 hour = PHI * MULTIPLIER scraps ≈ 16.18 scraps
// So $1 ≈ PHI * MULTIPLIER / 4 ≈ 4.045 scraps
const DOLLARS_PER_HOUR_GRANT = 4;
const SCRAPS_PER_GRANT_DOLLAR = (PHI * MULTIPLIER) / DOLLARS_PER_HOUR_GRANT;

/**
 * Compute optimal shop item pricing from real-world cost.
 *
 * @param dollarCost  - what the item costs us in USD
 * @param baseProbability - desired base win chance 1-100 (optional, auto-computed if omitted)
 * @param stockCount  - how many we have in stock (used for auto-probability)
 * @returns full pricing breakdown including scraps price, roll cost, upgrade curve
 */
export function computeItemPricing(
  dollarCost: number,
  baseProbability?: number,
  stockCount: number = 1,
): {
  /** scraps price (item face value) */
  price: number;
  /** base win probability 1-100 */
  baseProbability: number;
  /** cost of first refinery upgrade */
  baseUpgradeCost: number;
  /** multiplier per upgrade level (percentage, e.g. 110 = 1.1x) */
  costMultiplier: number;
  /** probability boost per upgrade */
  boostAmount: number;
  /** cost per roll attempt */
  rollCost: number;
  /** estimated rolls to win at base probability */
  expectedRollsAtBase: number;
  /** expected total roll spend at base probability */
  expectedSpendAtBase: number;
  /** dollar cost input */
  dollarCost: number;
  /** scraps per dollar used */
  scrapsPerDollar: number;
} {
  // Convert dollar cost to scraps using grant-weighted rate
  const price = Math.max(1, Math.round(dollarCost * SCRAPS_PER_GRANT_DOLLAR));

  // If caller supplied a base probability, use it; otherwise auto-compute
  let prob: number;
  if (
    baseProbability !== undefined &&
    baseProbability >= 1 &&
    baseProbability <= 100
  ) {
    prob = Math.round(baseProbability);
  } else {
    // Auto: rarer for expensive items, more common for cheap/plentiful ones
    const priceRarityFactor = Math.max(0, 1 - dollarCost / 100);
    const stockRarityFactor = Math.min(1, stockCount / 20);
    prob = Math.max(
      1,
      Math.min(
        80,
        Math.round((priceRarityFactor * 0.4 + stockRarityFactor * 0.6) * 80),
      ),
    );
  }

  // Roll cost: fixed fraction of price based on base probability
  const rollCost = Math.max(1, Math.round(price * (prob / 100)));

  // Expected rolls to win = 1 / (prob / 100)
  const expectedRollsAtBase = Math.round((100 / prob) * 10) / 10;
  const expectedSpendAtBase = Math.round(rollCost * expectedRollsAtBase);

  // Upgrade curve: total budget = 1.7x price, upgrade budget = budget - rollCost
  const upgradeBudget = Math.max(0, price * 1.7 - rollCost);
  const probabilityGap = 100 - prob;
  const targetUpgrades = Math.max(5, Math.min(20, Math.ceil(dollarCost / 5)));
  const boostAmount = Math.max(1, Math.round(probabilityGap / targetUpgrades));
  const actualUpgrades = Math.ceil(probabilityGap / boostAmount);

  const costMultiplier = 110;
  const multiplierDecimal = costMultiplier / 100;

  let baseUpgradeCost: number;
  if (actualUpgrades <= 0 || upgradeBudget <= 0) {
    baseUpgradeCost = Math.max(1, Math.round(price * 0.05));
  } else {
    const seriesSum =
      (Math.pow(multiplierDecimal, actualUpgrades) - 1) /
      (multiplierDecimal - 1);
    baseUpgradeCost = Math.max(1, Math.round(upgradeBudget / seriesSum));
  }

  return {
    price,
    baseProbability: prob,
    baseUpgradeCost,
    costMultiplier,
    boostAmount,
    rollCost,
    expectedRollsAtBase,
    expectedSpendAtBase,
    dollarCost,
    scrapsPerDollar: SCRAPS_PER_GRANT_DOLLAR,
  };
}

export async function updateShopItemPricing() {
  try {
    const items = await db
      .select({
        id: shopItemsTable.id,
        name: shopItemsTable.name,
        price: shopItemsTable.price,
        count: shopItemsTable.count,
      })
      .from(shopItemsTable);

    let updated = 0;
    for (const item of items) {
      const monetaryValue = item.price / SCRAPS_PER_DOLLAR;
      const pricing = calculateShopItemPricing(monetaryValue, item.count);

      await db
        .update(shopItemsTable)
        .set({
          baseProbability: pricing.baseProbability,
          baseUpgradeCost: pricing.baseUpgradeCost,
          costMultiplier: pricing.costMultiplier,
          boostAmount: pricing.boostAmount,
          updatedAt: new Date(),
        })
        .where(eq(shopItemsTable.id, item.id));

      updated++;
    }

    console.log(`[STARTUP] Updated pricing for ${updated} shop items`);
  } catch (err) {
    console.error("[STARTUP] Failed to update shop item pricing:", err);
  }
}
