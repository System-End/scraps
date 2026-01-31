<script lang="ts">
	import { onMount } from 'svelte'
	import HeartButton from '$lib/components/HeartButton.svelte'
	import { API_URL } from '$lib/config'
	import { getUser } from '$lib/auth-client'

	interface ShopItem {
		id: number
		name: string
		description: string
		image: string
		price: number
		category: string
		count: number
		heartCount: number
		userHearted: boolean
	}

	interface User {
		id: number
		username: string
		email: string
		avatar: string | null
		slackId: string | null
		scraps: number
		role: string
	}

	let items = $state<ShopItem[]>([])
	let selectedCategory = $state('all')
	let loading = $state(true)
	let user = $state<User | null>(null)
	let screws = $derived(user?.scraps ?? 0)

	let categories = $derived(['all', ...new Set(items.map((item) => item.category))])

	let filteredItems = $derived(
		selectedCategory === 'all'
			? items
			: items.filter((item) => item.category === selectedCategory)
	)

	onMount(async () => {
		user = await getUser()
		try {
			const response = await fetch(`${API_URL}/shop/items`, {
				credentials: 'include'
			})
			if (response.ok) {
				items = await response.json()
			}
		} catch (error) {
			console.error('Failed to fetch shop items:', error)
		} finally {
			loading = false
		}
	})

	async function toggleHeart(itemId: number) {
		try {
			const response = await fetch(`${API_URL}/shop/items/${itemId}/heart`, {
				method: 'POST',
				credentials: 'include'
			})
			if (response.ok) {
				items = items.map((item) => {
					if (item.id === itemId) {
						return {
							...item,
							userHearted: !item.userHearted,
							heartCount: item.userHearted ? item.heartCount - 1 : item.heartCount + 1
						}
					}
					return item
				})
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
	<h1 class="text-4xl md:text-6xl font-bold mb-4">shop</h1>
	<p class="text-lg text-gray-600 mb-8">items up for grabs</p>

	<!-- Category Filter -->
	<div class="flex gap-2 mb-8 flex-wrap">
		{#each categories as category}
			<button
				onclick={() => (selectedCategory = category)}
				class="px-4 py-2 border-2 border-black rounded-full font-bold transition-all {selectedCategory === category
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				{category}
			</button>
		{/each}
	</div>

	<!-- Loading State -->
	{#if loading}
		<div class="text-center py-12">
			<p class="text-gray-600">Loading items...</p>
		</div>
	{:else if items.length === 0}
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
					<div class="flex items-center justify-between mb-3">
						<span class="text-sm font-bold">{item.price} screws</span>
						<span class="text-xs px-2 py-1 bg-gray-100 rounded-full">{item.category}</span>
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
