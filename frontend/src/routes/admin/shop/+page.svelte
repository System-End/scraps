<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { Plus, Pencil, Trash2, X } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface ShopItem {
		id: number
		name: string
		image: string
		description: string
		price: number
		category: string
		count: number
		createdAt: string
		updatedAt: string
	}

	interface User {
		id: number
		role: string
	}

	let user = $state<User | null>(null)
	let items = $state<ShopItem[]>([])
	let loading = $state(true)
	let saving = $state(false)

	let showModal = $state(false)
	let editingItem = $state<ShopItem | null>(null)

	let formName = $state('')
	let formImage = $state('')
	let formDescription = $state('')
	let formPrice = $state(0)
	let formCategory = $state('')
	let formCount = $state(0)
	let formError = $state<string | null>(null)

	onMount(async () => {
		user = await getUser()
		if (!user || user.role !== 'admin') {
			goto('/dashboard')
			return
		}

		await fetchItems()
	})

	async function fetchItems() {
		loading = true
		try {
			const response = await fetch(`${API_URL}/admin/shop/items`, {
				credentials: 'include'
			})
			if (response.ok) {
				items = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch items:', e)
		} finally {
			loading = false
		}
	}

	function openCreateModal() {
		editingItem = null
		formName = ''
		formImage = ''
		formDescription = ''
		formPrice = 0
		formCategory = ''
		formCount = 0
		formError = null
		showModal = true
	}

	function openEditModal(item: ShopItem) {
		editingItem = item
		formName = item.name
		formImage = item.image
		formDescription = item.description
		formPrice = item.price
		formCategory = item.category
		formCount = item.count
		formError = null
		showModal = true
	}

	function closeModal() {
		showModal = false
		editingItem = null
	}

	async function handleSubmit() {
		if (!formName.trim() || !formImage.trim() || !formDescription.trim() || !formCategory.trim()) {
			formError = 'All fields are required'
			return
		}

		saving = true
		formError = null

		try {
			const url = editingItem
				? `${API_URL}/admin/shop/items/${editingItem.id}`
				: `${API_URL}/admin/shop/items`

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
					count: formCount
				})
			})

			if (response.ok) {
				closeModal()
				await fetchItems()
			} else {
				const data = await response.json()
				formError = data.error || 'Failed to save'
			}
		} catch (e) {
			formError = 'Failed to save item'
		} finally {
			saving = false
		}
	}

	async function deleteItem(id: number) {
		if (!confirm('Are you sure you want to delete this item?')) return

		try {
			const response = await fetch(`${API_URL}/admin/shop/items/${id}`, {
				method: 'DELETE',
				credentials: 'include'
			})
			if (response.ok) {
				await fetchItems()
			}
		} catch (e) {
			console.error('Failed to delete:', e)
		}
	}
</script>

<svelte:head>
	<title>shop editor | admin | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-4xl md:text-5xl font-bold mb-2">shop</h1>
			<p class="text-lg text-gray-600">manage shop items and inventory</p>
		</div>
		<button
			onclick={openCreateModal}
			class="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 cursor-pointer"
		>
			<Plus size={20} />
			add item
		</button>
	</div>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if items.length === 0}
		<div class="text-center py-12 text-gray-500">no items yet</div>
	{:else}
		<div class="grid gap-4">
			{#each items as item}
				<div class="border-4 border-black rounded-2xl p-4 flex items-center gap-4">
					<img
						src={item.image}
						alt={item.name}
						class="w-20 h-20 object-cover rounded-lg border-2 border-black shrink-0"
					/>
					<div class="flex-1 min-w-0">
						<h3 class="font-bold text-xl">{item.name}</h3>
						<p class="text-sm text-gray-600 truncate">{item.description}</p>
						<div class="flex items-center gap-2 mt-1 text-sm flex-wrap">
							<span class="font-bold">{item.price} scraps</span>
							{#each item.category.split(',').map(c => c.trim()).filter(Boolean) as cat}
								<span class="px-2 py-0.5 bg-gray-100 rounded-full">{cat}</span>
							{/each}
							<span class="text-gray-500">{item.count} in stock</span>
						</div>
					</div>
					<div class="flex gap-2 shrink-0">
						<button
							onclick={() => openEditModal(item)}
							class="p-2 border-4 border-black rounded-lg hover:border-dashed transition-all duration-200 cursor-pointer"
						>
							<Pencil size={18} />
						</button>
						<button
							onclick={() => deleteItem(item.id)}
							class="p-2 border-4 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-all duration-200 cursor-pointer"
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
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold">{editingItem ? 'edit item' : 'add item'}</h2>
				<button onclick={closeModal} class="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
					<X size={20} />
				</button>
			</div>

			{#if formError}
				<div class="mb-4 p-3 bg-red-50 border-2 border-red-600 rounded-lg text-red-600 text-sm">
					{formError}
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-bold mb-1">name</label>
					<input
						id="name"
						type="text"
						bind:value={formName}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="image" class="block text-sm font-bold mb-1">image URL</label>
					<input
						id="image"
						type="text"
						bind:value={formImage}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="description" class="block text-sm font-bold mb-1">description</label>
					<textarea
						id="description"
						bind:value={formDescription}
						rows="3"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="price" class="block text-sm font-bold mb-1">price (scraps)</label>
						<input
							id="price"
							type="number"
							bind:value={formPrice}
							min="0"
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
					<div>
						<label for="count" class="block text-sm font-bold mb-1">stock count</label>
						<input
							id="count"
							type="number"
							bind:value={formCount}
							min="0"
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
				</div>

				<div>
					<label for="category" class="block text-sm font-bold mb-1">categories (comma separated)</label>
					<input
						id="category"
						type="text"
						bind:value={formCategory}
						placeholder="stickers, hardware, misc"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={closeModal}
					disabled={saving}
					class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
				>
					cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={saving}
					class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold border-4 border-black hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
				>
					{saving ? 'saving...' : editingItem ? 'save' : 'create'}
				</button>
			</div>
		</div>
	</div>
{/if}
