<script lang="ts">
	import { onMount } from 'svelte'
	import { getUser, refreshUserScraps, userScrapsStore } from '$lib/auth-client'
	import { shopItemsStore, shopLoading, fetchShopItems, type ShopItem } from '$lib/stores'

	let probabilityItems = $derived(
		$shopItemsStore.filter(item => item.baseProbability > 0)
	)
	let upgrading = $state<number | null>(null)
	let alertMessage = $state<string | null>(null)

	function calculateNextCost(item: ShopItem): number {
		return Math.floor(item.baseUpgradeCost * Math.pow(item.costMultiplier / 100, item.userBoostPercent))
	}

	function getProbabilityColor(probability: number): string {
		if (probability >= 70) return 'text-green-600'
		if (probability >= 40) return 'text-yellow-600'
		return 'text-red-600'
	}

	async function upgradeProbability(item: ShopItem) {
		upgrading = item.id
		try {
			const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/shop/items/${item.id}/upgrade-probability`, {
				method: 'POST',
				credentials: 'include'
			})
			const data = await res.json()
			if (data.error) {
				alertMessage = data.error
				return
			}
			shopItemsStore.update(items =>
				items.map(i =>
					i.id === item.id
						? { ...i, userBoostPercent: data.boostPercent, effectiveProbability: data.effectiveProbability }
						: i
				)
			)
			await refreshUserScraps()
		} catch (e) {
			alertMessage = 'Failed to upgrade probability'
		} finally {
			upgrading = null
		}
	}

	onMount(async () => {
		await getUser()
		fetchShopItems()
	})
</script>

<svelte:head>
	<title>refinery - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<div class="mb-8">
		<h1 class="text-4xl md:text-5xl font-bold mb-2">refinery</h1>
		<p class="text-lg text-gray-600">upgrade your luck</p>
	</div>

	{#if $shopLoading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if probabilityItems.length > 0}
		<div class="space-y-6">
			{#each probabilityItems as item (item.id)}
				{@const nextCost = calculateNextCost(item)}
				{@const maxed = item.effectiveProbability >= 100}
				<div class="border-4 border-black rounded-2xl p-6 hover:border-dashed transition-all">
					<div class="flex items-start gap-4">
						{#if item.image}
							<img
								src={item.image}
								alt={item.name}
								class="w-16 h-16 object-cover rounded-lg border-2 border-black"
							/>
						{:else}
							<div
								class="w-16 h-16 bg-gray-100 rounded-lg border-2 border-black flex items-center justify-center"
							>
								<span class="text-2xl">?</span>
							</div>
						{/if}
						<div class="flex-1">
							<h3 class="font-bold text-xl">{item.name}</h3>
							<div class="flex items-center gap-2 mt-1">
								<span class="font-bold text-2xl {getProbabilityColor(item.effectiveProbability)}">
									{item.effectiveProbability}%
								</span>
								<span class="text-gray-600 text-sm">
									({item.baseProbability}% base + {item.userBoostPercent}% boost)
								</span>
							</div>
						</div>
						<div class="text-right">
							{#if maxed}
								<span class="px-4 py-2 bg-gray-200 rounded-full font-bold text-gray-600">maxed</span>
							{:else}
								<button
									onclick={() => upgradeProbability(item)}
									disabled={upgrading === item.id || $userScrapsStore < nextCost}
									class="px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
								>
									{#if upgrading === item.id}
										upgrading...
									{:else}
										upgrade +1% ({nextCost} scraps)
									{/if}
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-12 text-gray-500">no items available for upgrades</div>
	{/if}
</div>

{#if alertMessage}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={(e) => e.target === e.currentTarget && (alertMessage = null)}
		onkeydown={(e) => e.key === 'Escape' && (alertMessage = null)}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
			<h2 class="text-2xl font-bold mb-4">error</h2>
			<p class="text-gray-600 mb-6">{alertMessage}</p>
			<button
				onclick={() => (alertMessage = null)}
				class="w-full px-4 py-2 bg-black text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 cursor-pointer"
			>
				ok
			</button>
		</div>
	</div>
{/if}
