<script lang="ts">
	import { onMount } from 'svelte'
	import HeartButton from '$lib/components/HeartButton.svelte'
	import ShopItemModal from '$lib/components/ShopItemModal.svelte'
	import AddressSelectModal from '$lib/components/AddressSelectModal.svelte'
	import { API_URL } from '$lib/config'
	import { getUser } from '$lib/auth-client'
	import { X, Spool, PackageCheck, Clock } from '@lucide/svelte'
	import {
		shopItemsStore,
		shopLoading,
		fetchShopItems,
		updateShopItemHeart,
		type ShopItem
	} from '$lib/stores'

	const PHI = (1 + Math.sqrt(5)) / 2
	const MULTIPLIER = 10

	function estimateHours(scraps: number): number {
		return Math.round(scraps / (PHI * MULTIPLIER) * 10) / 10
	}

	let selectedCategories = $state<Set<string>>(new Set())
	let sortBy = $state<'default' | 'favorites' | 'probability'>('default')

	let selectedItem = $state<ShopItem | null>(null)
	let winningOrderId = $state<number | null>(null)
	let winningItemName = $state<string | null>(null)
	let pendingOrders = $state<{ orderId: number; itemName: string }[]>([])

	let consolationOrderId = $state<number | null>(null)
	let consolationRolled = $state<number | null>(null)
	let consolationNeeded = $state<number | null>(null)

	let categories = $derived.by(() => {
		const allCategories = new Set<string>()
		$shopItemsStore.forEach((item) => {
			item.category.split(',').forEach((cat) => {
				const trimmed = cat.trim()
				if (trimmed) allCategories.add(trimmed)
			})
		})
		return Array.from(allCategories).sort()
	})

	let filteredItems = $derived(
		selectedCategories.size === 0
			? $shopItemsStore
			: $shopItemsStore.filter((item) =>
					item.category
						.split(',')
						.map((c) => c.trim())
						.some((cat) => selectedCategories.has(cat))
				)
	)

	let sortedItems = $derived.by(() => {
		let items = [...filteredItems]
		if (sortBy === 'favorites') {
			return items.sort((a, b) => b.heartCount - a.heartCount)
		} else if (sortBy === 'probability') {
			return items.sort((a, b) => b.effectiveProbability - a.effectiveProbability)
		}
		return items
	})

	function toggleCategory(category: string) {
		const newSet = new Set(selectedCategories)
		if (newSet.has(category)) {
			newSet.delete(category)
		} else {
			newSet.add(category)
		}
		selectedCategories = newSet
	}

	function clearFilters() {
		selectedCategories = new Set()
	}

	function getProbabilityColor(prob: number): string {
		if (prob >= 70) return 'text-green-600'
		if (prob >= 40) return 'text-yellow-600'
		return 'text-red-600'
	}

	function getProbabilityBgColor(prob: number): string {
		if (prob >= 70) return 'bg-green-100'
		if (prob >= 40) return 'bg-yellow-100'
		return 'bg-red-100'
	}

	async function checkPendingOrders() {
		try {
			const response = await fetch(`${API_URL}/shop/orders/pending-address`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				if (Array.isArray(data) && data.length > 0) {
					pendingOrders = data.map((o: { id: number; itemName: string }) => ({
						orderId: o.id,
						itemName: o.itemName
					}))
					const first = pendingOrders[0]
					winningOrderId = first.orderId
					winningItemName = first.itemName
				}
			}
		} catch (e) {
			console.error('Failed to check pending orders:', e)
		}
	}

	function handleTryLuck(orderId: number) {
		if (selectedItem) {
			winningItemName = selectedItem.name
		}
		winningOrderId = orderId
		selectedItem = null
	}

	function handleConsolation(orderId: number, rolled: number, needed: number) {
		consolationOrderId = orderId
		consolationRolled = rolled
		consolationNeeded = needed
		selectedItem = null
	}

	function handleAddressComplete() {
		fetchShopItems(true)
		winningOrderId = null
		winningItemName = null
		pendingOrders = pendingOrders.slice(1)
		if (pendingOrders.length > 0) {
			const next = pendingOrders[0]
			winningOrderId = next.orderId
			winningItemName = next.itemName
		}
	}

	onMount(async () => {
		await getUser()
		fetchShopItems()
		checkPendingOrders()
	})

	async function toggleHeart(itemId: number) {
		try {
			const response = await fetch(`${API_URL}/shop/items/${itemId}/heart`, {
				method: 'POST',
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				updateShopItemHeart(itemId, data.hearted, data.heartCount)
			}
		} catch (error) {
			console.error('Failed to toggle heart:', error)
		}
	}
</script>

<svelte:head>
	<title>shop - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-2">shop</h1>
	<p class="text-lg text-gray-600 mb-8">items up for grabs</p>

	<!-- Filters & Sort -->
	<div class="flex flex-wrap gap-2 items-center mb-8">
		<!-- Category Filter -->
		<span class="text-sm font-bold self-center mr-2">tags:</span>
		{#each categories as category}
			<button
				onclick={() => toggleCategory(category)}
				class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {selectedCategories.has(category)
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				{category}
			</button>
		{/each}
		{#if selectedCategories.size > 0}
			<button
				onclick={clearFilters}
				class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer hover:border-dashed flex items-center gap-2"
			>
				<X size={16} />
				clear
			</button>
		{/if}

		<span class="mx-4 border-l-2 border-gray-300 h-8"></span>

		<!-- Sort Options -->
		<span class="text-sm font-bold self-center mr-2">sort:</span>
		<button
			onclick={() => (sortBy = 'default')}
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {sortBy ===
			'default'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
		>
			default
		</button>
		<button
			onclick={() => (sortBy = 'favorites')}
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {sortBy ===
			'favorites'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
		>
			favorites
		</button>
		<button
			onclick={() => (sortBy = 'probability')}
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {sortBy ===
			'probability'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
		>
			probability
		</button>
	</div>

	<!-- Loading State -->
	{#if $shopLoading}
		<div class="text-center py-12">
			<p class="text-gray-600">Loading items...</p>
		</div>
	{:else if $shopItemsStore.length === 0}
		<div class="text-center py-12">
			<p class="text-gray-600">No items available</p>
		</div>
	{:else}
		<!-- Items Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
			{#each sortedItems as item (item.id)}
				<button
					onclick={() => (selectedItem = item)}
					class="border-4 border-black rounded-2xl p-4 hover:border-dashed transition-all cursor-pointer text-left relative overflow-hidden {item.count === 0 ? 'bg-gray-100' : ''}"
				>
					{#if item.count === 0}
						<div class="absolute top-0 right-0 z-20">
							<div class="bg-red-600 text-white text-xs font-bold px-8 py-1 transform rotate-45 translate-x-6 translate-y-3 shadow-md">
								sold out
							</div>
						</div>
					{/if}
					<div class="relative {item.count === 0 ? 'opacity-50 grayscale' : ''}">
						<img src={item.image} alt={item.name} class="w-full h-32 object-contain mb-4" />
						<span
							class="absolute top-0 right-0 text-xs font-bold px-2 py-1 rounded-full {getProbabilityBgColor(item.effectiveProbability)} {getProbabilityColor(item.effectiveProbability)}"
						>
							{item.effectiveProbability.toFixed(0)}% chance
						</span>
					</div>
					<div class={item.count === 0 ? 'opacity-50' : ''}>
						<h3 class="font-bold text-xl mb-1">{item.name}</h3>
						<p class="text-sm text-gray-600 mb-2">{item.description}</p>
						<div class="mb-3">
							<span class="text-lg font-bold flex items-center gap-1"><Spool size={18} />{item.price}</span>
							<span class="text-xs text-gray-500 flex items-center gap-1 mt-1"><Clock size={14} />~{estimateHours(item.price)}h</span>
							<div class="flex gap-1 flex-wrap mt-2">
								{#each item.category.split(',').map((c) => c.trim()).filter(Boolean) as cat}
									<span class="text-xs px-2 py-1 bg-gray-100 rounded-full">{cat}</span>
								{/each}
							</div>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-xs {item.count === 0 ? 'text-red-500 font-bold' : 'text-gray-500'}">{item.count === 0 ? 'sold out' : `${item.count} left`}</span>
							<HeartButton
								count={item.heartCount}
								hearted={item.userHearted}
								onclick={(e) => {
									e.stopPropagation()
									toggleHeart(item.id)
								}}
							/>
						</div>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

{#if selectedItem}
	<ShopItemModal
		item={selectedItem}
		onClose={() => (selectedItem = null)}
		onTryLuck={handleTryLuck}
		onConsolation={handleConsolation}
	/>
{/if}

{#if winningOrderId && winningItemName}
	<AddressSelectModal
		orderId={winningOrderId}
		itemName={winningItemName}
		onClose={() => {
			winningOrderId = null
			winningItemName = null
		}}
		onComplete={handleAddressComplete}
	/>
{/if}

{#if consolationOrderId}
	<AddressSelectModal
		orderId={consolationOrderId}
		itemName="consolation scrap paper"
		onClose={() => {
			consolationOrderId = null
			consolationRolled = null
			consolationNeeded = null
		}}
		onComplete={() => {
			consolationOrderId = null
			consolationRolled = null
			consolationNeeded = null
		}}
	>
		{#snippet header()}
			<div class="mb-4 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl">
				<p class="font-bold text-yellow-800">better luck next time!</p>
				<p class="text-sm text-yellow-700 mt-1">
					you rolled {consolationRolled} but needed {consolationNeeded} or less.
				</p>
				<p class="text-sm text-yellow-700 mt-2">
					as a consolation, we'll send you a random scrap of paper from hack club hq! just tell us where to ship it.
				</p>
			</div>
		{/snippet}
	</AddressSelectModal>
{/if}

<a
	href="/orders"
	class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 border-4 border-black cursor-pointer"
>
	<PackageCheck size={20} />
	<span>my orders</span>
</a>
