<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Plus, Pencil, Trash2, X, Spool } from '@lucide/svelte';
	import { getUser } from '$lib/auth-client';
	import { API_URL } from '$lib/config';

	interface ShopItem {
		id: number;
		name: string;
		image: string;
		description: string;
		price: number;
		category: string;
		count: number;
		baseProbability: number;
		baseUpgradeCost: number;
		costMultiplier: number;
		boostAmount: number;
		createdAt: string;
		updatedAt: string;
	}

	interface User {
		id: number;
		role: string;
	}

	let user = $state<User | null>(null);
	let items = $state<ShopItem[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let showModal = $state(false);
	let editingItem = $state<ShopItem | null>(null);

	let formName = $state('');
	let formImage = $state('');
	let formDescription = $state('');
	let formPrice = $state(0);
	let formCategory = $state('');
	let formCount = $state(0);
	let formBaseProbability = $state(50);
	let formBaseUpgradeCost = $state(10);
	let formCostMultiplier = $state(101);
	let formBoostAmount = $state(1);
	let formMonetaryValue = $state(0);
	let formError = $state<string | null>(null);
	let errorModal = $state<string | null>(null);

	const PHI = (1 + Math.sqrt(5)) / 2;
	const SCRAPS_PER_HOUR = PHI * 10;
	const DOLLARS_PER_HOUR = 5;
	const SCRAPS_PER_DOLLAR = SCRAPS_PER_HOUR / DOLLARS_PER_HOUR;

	function calculatePricing(monetaryValue: number, stockCount: number) {
		const price = Math.round(monetaryValue * SCRAPS_PER_DOLLAR);

		// Rarity based on price and stock
		const priceRarityFactor = Math.max(0, 1 - monetaryValue / 100);
		const stockRarityFactor = Math.min(1, stockCount / 20);
		const baseProbability = Math.max(
			5,
			Math.min(80, Math.round((priceRarityFactor * 0.4 + stockRarityFactor * 0.6) * 80))
		);

		// Roll cost = price * (baseProbability / 100) - fixed
		const rollCost = Math.max(1, Math.round(price * (baseProbability / 100)));
		// Total budget = 1.5x price, upgrade budget = 1.5x price - rollCost
		const upgradeBudget = Math.max(0, price * 1.5 - rollCost);
		const probabilityGap = 100 - baseProbability;

		const targetUpgrades = Math.max(5, Math.min(20, Math.ceil(monetaryValue / 5)));
		const boostAmount = Math.max(1, Math.round(probabilityGap / targetUpgrades));
		const actualUpgrades = Math.ceil(probabilityGap / boostAmount);

		const costMultiplier = 110;
		const multiplierDecimal = costMultiplier / 100;

		let baseUpgradeCost: number;
		if (actualUpgrades <= 0 || upgradeBudget <= 0) {
			baseUpgradeCost = Math.round(price * 0.05) || 1;
		} else {
			const seriesSum =
				(Math.pow(multiplierDecimal, actualUpgrades) - 1) / (multiplierDecimal - 1);
			baseUpgradeCost = Math.max(1, Math.round(upgradeBudget / seriesSum));
		}

		return { price, baseProbability, baseUpgradeCost, costMultiplier, boostAmount };
	}

	function recalculatePricing() {
		const pricing = calculatePricing(formMonetaryValue, formCount);
		formPrice = pricing.price;
		formBaseProbability = pricing.baseProbability;
		formBaseUpgradeCost = pricing.baseUpgradeCost;
		formCostMultiplier = pricing.costMultiplier;
		formBoostAmount = pricing.boostAmount;
	}

	function updateFromMonetary(value: number) {
		formMonetaryValue = value;
		recalculatePricing();
	}

	function updateFromStock(value: number) {
		formCount = value;
		recalculatePricing();
	}
	let deleteConfirmId = $state<number | null>(null);

	onMount(async () => {
		user = await getUser();
		if (!user || user.role !== 'admin') {
			goto('/dashboard');
			return;
		}

		await fetchItems();
	});

	async function fetchItems() {
		loading = true;
		try {
			const response = await fetch(`${API_URL}/admin/shop/items`, {
				credentials: 'include'
			});
			if (response.ok) {
				items = await response.json();
			}
		} catch (e) {
			console.error('Failed to fetch items:', e);
		} finally {
			loading = false;
		}
	}

	function openCreateModal() {
		editingItem = null;
		formName = '';
		formImage = '';
		formDescription = '';
		formPrice = 0;
		formMonetaryValue = 0;
		formCategory = '';
		formCount = 0;
		formBaseProbability = 50;
		formBaseUpgradeCost = 10;
		formCostMultiplier = 101;
		formBoostAmount = 1;
		formError = null;
		showModal = true;
	}

	function openEditModal(item: ShopItem) {
		editingItem = item;
		formName = item.name;
		formImage = item.image;
		formDescription = item.description;
		formPrice = item.price;
		formMonetaryValue = item.price / SCRAPS_PER_DOLLAR;
		formCategory = item.category;
		formCount = item.count;
		formBaseProbability = item.baseProbability;
		formBaseUpgradeCost = item.baseUpgradeCost;
		formCostMultiplier = item.costMultiplier;
		formBoostAmount = item.boostAmount ?? 1;
		formError = null;
		showModal = true;
	}

	function closeModal() {
		showModal = false;
		editingItem = null;
	}

	async function handleSubmit() {
		if (!formName.trim() || !formImage.trim() || !formDescription.trim() || !formCategory.trim()) {
			formError = 'All fields are required';
			return;
		}

		saving = true;
		formError = null;

		try {
			const url = editingItem
				? `${API_URL}/admin/shop/items/${editingItem.id}`
				: `${API_URL}/admin/shop/items`;

			const response = await fetch(url, {
				method: editingItem ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: formName,
					image: formImage,
					description: formDescription,
					price: formPrice,
					category: formCategory,
					count: formCount,
					baseProbability: formBaseProbability,
					baseUpgradeCost: formBaseUpgradeCost,
					costMultiplier: formCostMultiplier,
					boostAmount: formBoostAmount
				})
			});

			if (response.ok) {
				closeModal();
				await fetchItems();
			} else {
				const data = await response.json();
				formError = data.error || 'Failed to save';
			}
		} catch (e) {
			formError = 'Failed to save item';
		} finally {
			saving = false;
		}
	}

	function requestDelete(id: number) {
		deleteConfirmId = id;
	}

	async function confirmDelete() {
		if (!deleteConfirmId) return;

		try {
			const response = await fetch(`${API_URL}/admin/shop/items/${deleteConfirmId}`, {
				method: 'DELETE',
				credentials: 'include'
			});
			if (response.ok) {
				await fetchItems();
			} else {
				const data = await response.json();
				errorModal = data.error || 'Failed to delete item';
			}
		} catch (e) {
			console.error('Failed to delete:', e);
			errorModal = 'Failed to delete item';
		} finally {
			deleteConfirmId = null;
		}
	}
</script>

<svelte:head>
	<title>shop editor - admin - scraps</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-6 pt-24 pb-24 md:px-12">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="mb-2 text-4xl font-bold md:text-5xl">shop</h1>
			<p class="text-lg text-gray-600">manage shop items and inventory</p>
		</div>
		<button
			onclick={openCreateModal}
			class="flex cursor-pointer items-center gap-2 rounded-full bg-black px-6 py-3 font-bold text-white transition-all duration-200 hover:bg-gray-800"
		>
			<Plus size={20} />
			add item
		</button>
	</div>

	<div class="mb-8 rounded-2xl border-4 border-black p-4">
		<h3 class="mb-3 font-bold">scraps per hour reference</h3>
		<div class="grid grid-cols-4 gap-4 text-center text-sm">
			{#each [0.8, 1, 1.25, 1.5] as mult}
				<div class="rounded-lg bg-gray-100 p-3">
					<div class="mb-1 text-gray-500">{mult}x</div>
					<div class="flex items-center justify-center gap-1 font-bold">
						<Spool size={14} />
						{Math.round(SCRAPS_PER_HOUR * mult)}
					</div>
					<div class="text-xs text-gray-500">${(DOLLARS_PER_HOUR * mult).toFixed(2)}/hr</div>
				</div>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="py-12 text-center text-gray-500">loading...</div>
	{:else if items.length === 0}
		<div class="py-12 text-center text-gray-500">no items yet</div>
	{:else}
		<div class="grid gap-4">
			{#each items as item}
				<div class="flex items-center gap-4 rounded-2xl border-4 border-black p-4">
					<img
						src={item.image}
						alt={item.name}
						class="h-20 w-20 shrink-0 rounded-lg border-2 border-black object-cover"
					/>
					<div class="min-w-0 flex-1">
						<h3 class="text-xl font-bold">{item.name}</h3>
						<p class="truncate text-sm text-gray-600">{item.description}</p>
						<div class="mt-1 flex flex-wrap items-center gap-2 text-sm">
							<span class="font-bold">${(item.price / SCRAPS_PER_DOLLAR).toFixed(2)}</span>
							<span class="text-gray-500">•</span>
							<span class="flex items-center gap-1 font-bold"><Spool size={16} />{item.price}</span>
							{#each item.category
								.split(',')
								.map((c) => c.trim())
								.filter(Boolean) as cat}
								<span class="rounded-full bg-gray-100 px-2 py-0.5">{cat}</span>
							{/each}
							<span class="text-gray-500">{item.count} in stock</span>
							<span class="text-gray-500">•</span>
							<span class="text-gray-500">{item.baseProbability}%</span>
							<span class="text-gray-500">•</span>
							<span class="text-gray-500">+{item.boostAmount ?? 1}%/upgrade</span>
							<span class="text-gray-500">•</span>
							<span class="text-gray-500">~{(item.price / SCRAPS_PER_HOUR).toFixed(1)} hrs</span>
						</div>
					</div>
					<div class="flex shrink-0 gap-2">
						<button
							onclick={() => openEditModal(item)}
							class="cursor-pointer rounded-lg border-4 border-black p-2 transition-all duration-200 hover:border-dashed"
						>
							<Pencil size={18} />
						</button>
						<button
							onclick={() => requestDelete(item.id)}
							class="cursor-pointer rounded-lg border-4 border-red-600 p-2 text-red-600 transition-all duration-200 hover:bg-red-50"
						>
							<Trash2 size={18} />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-4 border-black bg-white p-6"
		>
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-2xl font-bold">{editingItem ? 'edit item' : 'add item'}</h2>
				<button
					onclick={closeModal}
					class="cursor-pointer rounded-lg p-2 transition-colors hover:bg-gray-100"
				>
					<X size={20} />
				</button>
			</div>

			{#if formError}
				<div class="mb-4 rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-600">
					{formError}
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="name" class="mb-1 block text-sm font-bold">name</label>
					<input
						id="name"
						type="text"
						bind:value={formName}
						class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
					/>
				</div>

				<div>
					<label for="image" class="mb-1 block text-sm font-bold">image URL</label>
					<input
						id="image"
						type="text"
						bind:value={formImage}
						class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
					/>
				</div>

				<div>
					<label for="description" class="mb-1 block text-sm font-bold">description</label>
					<textarea
						id="description"
						bind:value={formDescription}
						rows="3"
						class="w-full resize-none rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
					></textarea>
				</div>

				<div>
					<label for="monetaryValue" class="mb-1 block text-sm font-bold">value ($)</label>
					<input
						id="monetaryValue"
						type="number"
						value={formMonetaryValue}
						oninput={(e) => updateFromMonetary(parseFloat(e.currentTarget.value) || 0)}
						min="0"
						step="0.01"
						class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
					/>
					<p class="mt-1 text-xs text-gray-500">
						= {formPrice} scraps · {formBaseProbability}% base · +{formBoostAmount}%/upgrade ·
						~{(formPrice / SCRAPS_PER_HOUR).toFixed(1)} hrs to earn
					</p>
					{#if formPrice > 0}
						{@const rollCost = Math.max(1, Math.round(formPrice * (formBaseProbability / 100)))}
						{@const probabilityGap = 100 - formBaseProbability}
						{@const upgradesNeeded = Math.ceil(probabilityGap / formBoostAmount)}
						{@const multiplierDecimal = formCostMultiplier / 100}
						{@const totalUpgradeCost =
							formBaseUpgradeCost *
							((Math.pow(multiplierDecimal, upgradesNeeded) - 1) / (multiplierDecimal - 1))}
						{@const totalCost = totalUpgradeCost + rollCost}
						{@const maxBudget = formPrice * 1.5}
						<p class="mt-1 text-xs text-gray-500">
							roll cost: {rollCost} scraps · upgrades to 100%: {Math.round(totalUpgradeCost)} scraps
						</p>
						<p
							class="mt-1 text-xs {totalCost > maxBudget ? 'font-bold text-red-600' : 'text-gray-500'}"
						>
							total: {Math.round(totalCost)} scraps ({upgradesNeeded} upgrades + roll) ·
							budget: {Math.round(maxBudget)} (1.5×)
							{#if totalCost > maxBudget}· ⚠️ over budget!{/if}
						</p>
					{/if}
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="count" class="mb-1 block text-sm font-bold">stock count</label>
						<input
							id="count"
							type="number"
							value={formCount}
							oninput={(e) => updateFromStock(parseInt(e.currentTarget.value) || 0)}
							min="0"
							class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
						/>
						<p class="mt-1 text-xs text-gray-500">affects rarity calculation</p>
					</div>
					<div>
						<label for="category" class="mb-1 block text-sm font-bold">categories</label>
						<input
							id="category"
							type="text"
							bind:value={formCategory}
							placeholder="stickers, hardware"
							class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="baseProbability" class="mb-1 block text-sm font-bold"
							>base probability (%)</label
						>
						<input
							id="baseProbability"
							type="number"
							bind:value={formBaseProbability}
							min="0.1"
							max="100"
							step="0.1"
							class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
						/>
					</div>
					<div>
						<label for="boostAmount" class="mb-1 block text-sm font-bold"
							>boost per upgrade (%)</label
						>
						<input
							id="boostAmount"
							type="number"
							bind:value={formBoostAmount}
							min="1"
							class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="baseUpgradeCost" class="mb-1 block text-sm font-bold"
							>base upgrade cost</label
						>
						<input
							id="baseUpgradeCost"
							type="number"
							bind:value={formBaseUpgradeCost}
							min="0"
							class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
						/>
						<p class="mt-1 text-xs text-gray-500">auto-set to 10% of price</p>
					</div>
					<div>
						<label for="costMultiplier" class="mb-1 block text-sm font-bold"
							>cost multiplier (%)</label
						>
						<input
							id="costMultiplier"
							type="number"
							bind:value={formCostMultiplier}
							min="100"
							class="w-full rounded-lg border-2 border-black px-4 py-2 focus:border-dashed focus:outline-none"
						/>
						<p class="mt-1 text-xs text-gray-500">115 = 1.15x per upgrade</p>
					</div>
				</div>
			</div>

			<div class="mt-6 flex gap-3">
				<button
					onclick={closeModal}
					disabled={saving}
					class="flex-1 cursor-pointer rounded-full border-4 border-black px-4 py-2 font-bold transition-all duration-200 hover:border-dashed disabled:opacity-50"
				>
					cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={saving}
					class="flex-1 cursor-pointer rounded-full border-4 border-black bg-black px-4 py-2 font-bold text-white transition-all duration-200 hover:bg-gray-800 disabled:opacity-50"
				>
					{saving ? 'saving...' : editingItem ? 'save' : 'create'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if deleteConfirmId}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (deleteConfirmId = null)}
		onkeydown={(e) => e.key === 'Escape' && (deleteConfirmId = null)}
		role="dialog"
		tabindex="-1"
	>
		<div class="w-full max-w-md rounded-2xl border-4 border-black bg-white p-6">
			<h2 class="mb-4 text-2xl font-bold">confirm delete</h2>
			<p class="mb-6 text-gray-600">
				are you sure you want to delete this item? <span class="mt-2 block text-red-600"
					>this action cannot be undone.</span
				>
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (deleteConfirmId = null)}
					class="flex-1 cursor-pointer rounded-full border-4 border-black px-4 py-2 font-bold transition-all duration-200 hover:border-dashed"
				>
					cancel
				</button>
				<button
					onclick={confirmDelete}
					class="flex-1 cursor-pointer rounded-full border-4 border-black bg-red-600 px-4 py-2 font-bold text-white transition-all duration-200 hover:border-dashed"
				>
					delete
				</button>
			</div>
		</div>
	</div>
{/if}

{#if errorModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => e.target === e.currentTarget && (errorModal = null)}
		onkeydown={(e) => e.key === 'Escape' && (errorModal = null)}
		role="dialog"
		tabindex="-1"
	>
		<div class="w-full max-w-md rounded-2xl border-4 border-black bg-white p-6">
			<h2 class="mb-4 text-2xl font-bold">error</h2>
			<p class="mb-6 text-gray-600">{errorModal}</p>
			<button
				onclick={() => (errorModal = null)}
				class="w-full cursor-pointer rounded-full border-4 border-black bg-black px-4 py-2 font-bold text-white transition-all duration-200 hover:border-dashed"
			>
				ok
			</button>
		</div>
	</div>
{/if}
