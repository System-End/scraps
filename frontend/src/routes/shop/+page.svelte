<script lang="ts">
	import { onMount } from 'svelte';
	import HeartButton from '$lib/components/HeartButton.svelte';
	import ShopItemModal from '$lib/components/ShopItemModal.svelte';
	import AddressSelectModal from '$lib/components/AddressSelectModal.svelte';
	import { API_URL } from '$lib/config';
	import { getUser } from '$lib/auth-client';
	import { X, Spool, PackageCheck, Clock } from '@lucide/svelte';
	import {
		shopItemsStore,
		shopLoading,
		fetchShopItems,
		updateShopItemHeart,
		type ShopItem
	} from '$lib/stores';

	const PHI = (1 + Math.sqrt(5)) / 2;
	const MULTIPLIER = 10;

	function estimateHours(scraps: number): number {
		return Math.round((scraps / (PHI * MULTIPLIER)) * 10) / 10;
	}

	let selectedCategories = $state<Set<string>>(new Set());
	let sortBy = $state<'default' | 'favorites' | 'probability'>('default');

	let selectedItem = $state<ShopItem | null>(null);
	let winningOrderId = $state<number | null>(null);
	let winningItemName = $state<string | null>(null);
	let pendingOrders = $state<{ orderId: number; itemName: string }[]>([]);

	let consolationOrderId = $state<number | null>(null);
	let consolationRolled = $state<number | null>(null);
	let consolationNeeded = $state<number | null>(null);

	let categories = $derived.by(() => {
		const allCategories = new Set<string>();
		$shopItemsStore.forEach((item) => {
			item.category.split(',').forEach((cat) => {
				const trimmed = cat.trim();
				if (trimmed) allCategories.add(trimmed);
			});
		});
		return Array.from(allCategories).sort();
	});

	let filteredItems = $derived(
		selectedCategories.size === 0
			? $shopItemsStore
			: $shopItemsStore.filter((item) =>
					item.category
						.split(',')
						.map((c) => c.trim())
						.some((cat) => selectedCategories.has(cat))
				)
	);

	let sortedItems = $derived.by(() => {
		let items = [...filteredItems];
		if (sortBy === 'favorites') {
			return items.sort((a, b) => b.heartCount - a.heartCount);
		} else if (sortBy === 'probability') {
			return items.sort((a, b) => b.effectiveProbability - a.effectiveProbability);
		}
		return items;
	});

	function toggleCategory(category: string) {
		const newSet = new Set(selectedCategories);
		if (newSet.has(category)) {
			newSet.delete(category);
		} else {
			newSet.add(category);
		}
		selectedCategories = newSet;
	}

	function clearFilters() {
		selectedCategories = new Set();
	}

	function getProbabilityColor(prob: number): string {
		if (prob >= 70) return 'text-green-600';
		if (prob >= 40) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getProbabilityBgColor(prob: number): string {
		if (prob >= 70) return 'bg-green-100';
		if (prob >= 40) return 'bg-yellow-100';
		return 'bg-red-100';
	}

	async function checkPendingOrders() {
		try {
			const response = await fetch(`${API_URL}/shop/orders/pending-address`, {
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				if (Array.isArray(data) && data.length > 0) {
					pendingOrders = data.map((o: { id: number; itemName: string }) => ({
						orderId: o.id,
						itemName: o.itemName
					}));
					const first = pendingOrders[0];
					winningOrderId = first.orderId;
					winningItemName = first.itemName;
				}
			}
		} catch (e) {
			console.error('Failed to check pending orders:', e);
		}
	}

	function handleTryLuck(orderId: number) {
		if (selectedItem) {
			winningItemName = selectedItem.name;
		}
		winningOrderId = orderId;
		selectedItem = null;
	}

	function handleConsolation(orderId: number, rolled: number, needed: number) {
		consolationOrderId = orderId;
		consolationRolled = rolled;
		consolationNeeded = needed;
		selectedItem = null;
	}

	function handleAddressComplete() {
		fetchShopItems(true);
		winningOrderId = null;
		winningItemName = null;
		pendingOrders = pendingOrders.slice(1);
		if (pendingOrders.length > 0) {
			const next = pendingOrders[0];
			winningOrderId = next.orderId;
			winningItemName = next.itemName;
		}
	}

	onMount(async () => {
		await getUser();
		fetchShopItems();
		checkPendingOrders();
	});

	async function toggleHeart(itemId: number) {
		try {
			const response = await fetch(`${API_URL}/shop/items/${itemId}/heart`, {
				method: 'POST',
				credentials: 'include'
			});
			if (response.ok) {
				const data = await response.json();
				updateShopItemHeart(itemId, data.hearted, data.heartCount);
			}
		} catch (error) {
			console.error('Failed to toggle heart:', error);
		}
	}
</script>

<svelte:head>
	<title>shop - scraps</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-6 pt-24 pb-24 md:px-12">
	<h1 class="mb-2 text-4xl font-bold md:text-5xl">shop</h1>
	<p class="mb-8 text-lg text-gray-600">items up for grabs</p>

	<!-- Filters & Sort -->
	<div class="mb-8 space-y-3">
		<!-- Category Filter -->
		<div class="flex flex-wrap items-center gap-2">
			<span class="mr-2 self-center text-sm font-bold">tags:</span>
			{#each categories as category}
				<button
					onclick={() => toggleCategory(category)}
					class="cursor-pointer rounded-full border-4 border-black px-3 py-1.5 text-sm font-bold transition-all duration-200 sm:px-4 sm:py-2 {selectedCategories.has(
						category
					)
						? 'bg-black text-white'
						: 'hover:border-dashed'}"
				>
					{category}
				</button>
			{/each}
			{#if selectedCategories.size > 0}
				<button
					onclick={clearFilters}
					class="flex cursor-pointer items-center gap-2 rounded-full border-4 border-black px-3 py-1.5 text-sm font-bold transition-all duration-200 hover:border-dashed sm:px-4 sm:py-2"
				>
					<X size={16} />
					clear
				</button>
			{/if}
		</div>

		<!-- Sort Options -->
		<div class="flex flex-wrap items-center gap-2">
			<span class="mr-2 self-center text-sm font-bold">sort:</span>
			<button
				onclick={() => (sortBy = 'default')}
				class="cursor-pointer rounded-full border-4 border-black px-3 py-1.5 text-sm font-bold transition-all duration-200 sm:px-4 sm:py-2 {sortBy ===
				'default'
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				default
			</button>
			<button
				onclick={() => (sortBy = 'favorites')}
				class="cursor-pointer rounded-full border-4 border-black px-3 py-1.5 text-sm font-bold transition-all duration-200 sm:px-4 sm:py-2 {sortBy ===
				'favorites'
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				favorites
			</button>
			<button
				onclick={() => (sortBy = 'probability')}
				class="cursor-pointer rounded-full border-4 border-black px-3 py-1.5 text-sm font-bold transition-all duration-200 sm:px-4 sm:py-2 {sortBy ===
				'probability'
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				probability
			</button>
		</div>
	</div>

	<!-- Loading State -->
	{#if $shopLoading}
		<div class="py-12 text-center">
			<p class="text-gray-600">Loading items...</p>
		</div>
	{:else if $shopItemsStore.length === 0}
		<div class="py-12 text-center">
			<p class="text-gray-600">No items available</p>
		</div>
	{:else}
		<!-- Items Grid -->
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each sortedItems as item (item.id)}
				{@const rollCost = Math.max(1, Math.round(item.price * (item.baseProbability / 100)))}
				<button
					onclick={() => (selectedItem = item)}
					class="relative cursor-pointer overflow-hidden rounded-2xl border-4 border-black p-4 text-left transition-all hover:border-dashed {item.count ===
					0
						? 'bg-gray-100'
						: ''}"
				>
					{#if item.count === 0}
						<div class="absolute top-0 right-0 z-20">
							<div
								class="translate-x-6 translate-y-3 rotate-45 transform bg-red-600 px-8 py-1 text-xs font-bold text-white shadow-md"
							>
								sold out
							</div>
						</div>
					{/if}
					<div class="relative {item.count === 0 ? 'opacity-50 grayscale' : ''}">
						<img src={item.image} alt={item.name} class="mb-4 h-32 w-full object-contain" />
						<span
							class="absolute top-0 right-0 rounded-full px-2 py-1 text-xs font-bold {getProbabilityBgColor(
								item.effectiveProbability
							)} {getProbabilityColor(item.effectiveProbability)}"
						>
							{item.effectiveProbability.toFixed(0)}% chance
						</span>
					</div>
					<div class={item.count === 0 ? 'opacity-50' : ''}>
						<h3 class="mb-1 text-xl font-bold">{item.name}</h3>
						<p class="mb-2 text-sm text-gray-600">{item.description}</p>
						<div class="mb-3">
							<span class="flex items-center gap-1 text-lg font-bold"
								><Spool size={18} />{rollCost}</span
							>
							<span class="mt-1 flex items-center gap-1 text-xs text-gray-500"
								><Clock size={14} />~{estimateHours(rollCost)}h</span
							>
							<div class="mt-2 flex flex-wrap gap-1">
								{#each item.category
									.split(',')
									.map((c) => c.trim())
									.filter(Boolean) as cat}
									<span class="rounded-full bg-gray-100 px-2 py-1 text-xs">{cat}</span>
								{/each}
							</div>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-xs {item.count === 0 ? 'font-bold text-red-500' : 'text-gray-500'}"
								>{item.count === 0 ? 'sold out' : `${item.count} left`}</span
							>
							<HeartButton
								count={item.heartCount}
								hearted={item.userHearted}
								onclick={(e) => {
									e.stopPropagation();
									toggleHeart(item.id);
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
			winningOrderId = null;
			winningItemName = null;
		}}
		onComplete={handleAddressComplete}
	/>
{/if}

{#if consolationOrderId}
	<AddressSelectModal
		orderId={consolationOrderId}
		itemName="consolation scrap paper"
		onClose={() => {
			consolationOrderId = null;
			consolationRolled = null;
			consolationNeeded = null;
		}}
		onComplete={() => {
			consolationOrderId = null;
			consolationRolled = null;
			consolationNeeded = null;
		}}
	>
		{#snippet header()}
			<div class="mb-4 rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4">
				<p class="font-bold text-yellow-800">better luck next time!</p>
				<p class="mt-1 text-sm text-yellow-700">
					you rolled {consolationRolled} but needed {consolationNeeded} or less.
				</p>
				<p class="mt-2 text-sm text-yellow-700">
					as a consolation, we'll send you a random scrap of paper from hack club hq! just tell us
					where to ship it.
				</p>
			</div>
		{/snippet}
	</AddressSelectModal>
{/if}

<a
	href="/orders"
	class="fixed right-4 bottom-6 z-40 flex cursor-pointer items-center gap-2 rounded-full border-4 border-black bg-black px-4 py-2 font-bold text-white transition-all duration-200 hover:bg-gray-800 sm:right-6 sm:px-6 sm:py-3"
>
	<PackageCheck size={20} />
	<span class="hidden sm:inline">my orders</span>
</a>
