<script lang="ts">
	import { onMount } from 'svelte'
	import DashboardNavbar from '$lib/components/DashboardNavbar.svelte'
	import WishlistAvatars from '$lib/components/WishlistAvatars.svelte'

	interface WishlistUser {
		id: number
		name: string
		avatar: string
	}

	interface ShopItem {
		id: number
		name: string
		description: string
		image: string
		chance: number
		category: string
		wishlistUsers: WishlistUser[]
	}

	let items = $state<ShopItem[]>([])
	let screws = $state(42)
	let selectedCategory = $state('all')

	const dummyUsers: WishlistUser[] = [
		{ id: 1, name: 'zrl', avatar: 'https://avatars.githubusercontent.com/u/1234567?v=4' },
		{ id: 2, name: 'msw', avatar: 'https://avatars.githubusercontent.com/u/2345678?v=4' },
		{ id: 3, name: 'belle', avatar: 'https://avatars.githubusercontent.com/u/3456789?v=4' },
		{ id: 4, name: 'sam', avatar: 'https://avatars.githubusercontent.com/u/4567890?v=4' },
		{ id: 5, name: 'orpheus', avatar: 'https://avatars.githubusercontent.com/u/5678901?v=4' }
	]

	const dummyItems: ShopItem[] = [
		{ id: 1, name: 'esp32', description: 'a tiny microcontroller', image: '/hero.png', chance: 15, category: 'hardware', wishlistUsers: dummyUsers.slice(0, 4) },
		{ id: 2, name: 'arduino nano', description: 'compact arduino board', image: '/hero.png', chance: 10, category: 'hardware', wishlistUsers: dummyUsers.slice(1, 3) },
		{ id: 3, name: 'breadboard', description: 'for prototyping', image: '/hero.png', chance: 20, category: 'hardware', wishlistUsers: [] },
		{ id: 4, name: 'resistor pack', description: 'assorted resistors', image: '/hero.png', chance: 25, category: 'hardware', wishlistUsers: dummyUsers.slice(0, 1) },
		{ id: 5, name: 'vermont fudge', description: 'delicious!', image: '/hero.png', chance: 5, category: 'food', wishlistUsers: dummyUsers },
		{ id: 6, name: 'rare sticker', description: 'limited edition', image: '/hero.png', chance: 8, category: 'sticker', wishlistUsers: dummyUsers.slice(2, 5) },
		{ id: 7, name: 'postcard', description: 'from hq', image: '/hero.png', chance: 12, category: 'misc', wishlistUsers: dummyUsers.slice(0, 2) },
		{ id: 8, name: 'sensor kit', description: 'various sensors', image: '/hero.png', chance: 5, category: 'hardware', wishlistUsers: [] }
	]

	const categories = ['all', 'hardware', 'sticker', 'food', 'misc']

	let filteredItems = $derived(
		selectedCategory === 'all'
			? items
			: items.filter((item) => item.category === selectedCategory)
	)

	onMount(async () => {
		// TODO: Replace with actual API call to /api/items
		// const response = await fetch('/api/items')
		// items = await response.json()
		items = dummyItems
	})

	function addToWishlist(itemId: number) {
		// TODO: Call API to add item to user's wishlist
		console.log('Adding to wishlist:', itemId)
	}
</script>

<svelte:head>
	<title>shop | scraps</title>
</svelte:head>

<DashboardNavbar {screws} />

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

	<!-- Items Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
		{#each filteredItems as item (item.id)}
			<div
				class="border-4 border-black rounded-2xl p-4 hover:border-dashed transition-all"
			>
				<img src={item.image} alt={item.name} class="w-full h-32 object-contain mb-4" />
				<h3 class="font-bold text-xl mb-1">{item.name}</h3>
				<p class="text-sm text-gray-600 mb-2">{item.description}</p>
				<div class="flex items-center justify-between mb-3">
					<span class="text-sm font-bold">{item.chance}% chance</span>
					<span class="text-xs px-2 py-1 bg-gray-100 rounded-full">{item.category}</span>
				</div>
				<div class="flex items-center justify-between">
					<WishlistAvatars
						users={item.wishlistUsers}
						onWishlist={() => addToWishlist(item.id)}
					/>
				</div>
			</div>
		{/each}
	</div>
</div>
