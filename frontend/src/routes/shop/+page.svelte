<script lang="ts">
	import { onMount } from 'svelte'
	import HeartButton from '$lib/components/HeartButton.svelte'
	import { API_URL } from '$lib/config'
	import { getUser } from '$lib/auth-client'
	import { X, Spool } from '@lucide/svelte'
	import {
		shopItemsStore,
		shopLoading,
		fetchShopItems,
		updateShopItemHeart
	} from '$lib/stores'

	let selectedCategories = $state<Set<string>>(new Set())

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

	onMount(async () => {
		await getUser()
		fetchShopItems()
	})

	async function toggleHeart(itemId: number) {
		const item = $shopItemsStore.find((i) => i.id === itemId)
		if (!item) return

		try {
			const response = await fetch(`${API_URL}/shop/items/${itemId}/heart`, {
				method: 'POST',
				credentials: 'include'
			})
			if (response.ok) {
				updateShopItemHeart(itemId, !item.userHearted)
			}
		} catch (error) {
			console.error('Failed to toggle heart:', error)
		}
	}
</script>

<svelte:head>
	<title>shop | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-2">shop</h1>
	<p class="text-lg text-gray-600 mb-8">items up for grabs</p>

	<!-- Category Filter -->
	<div class="flex gap-2 mb-8 flex-wrap items-center">
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
			{#each filteredItems as item (item.id)}
				<div class="border-4 border-black rounded-2xl p-4 hover:border-dashed transition-all">
					<img src={item.image} alt={item.name} class="w-full h-32 object-contain mb-4" />
					<h3 class="font-bold text-xl mb-1">{item.name}</h3>
					<p class="text-sm text-gray-600 mb-2">{item.description}</p>
					<div class="mb-3">
						<span class="text-lg font-bold flex items-center gap-1"><Spool size={18} />{item.price}</span>
						<div class="flex gap-1 flex-wrap mt-2">
							{#each item.category.split(',').map(c => c.trim()).filter(Boolean) as cat}
								<span class="text-xs px-2 py-1 bg-gray-100 rounded-full">{cat}</span>
							{/each}
						</div>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-xs text-gray-500">{item.count} left</span>
						<HeartButton
							count={item.heartCount}
							hearted={item.userHearted}
							onclick={() => toggleHeart(item.id)}
						/>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
