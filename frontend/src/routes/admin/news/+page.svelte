<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { Plus, Pencil, Trash2, X, Eye, EyeOff } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface NewsItem {
		id: number
		title: string
		content: string
		active: boolean
		createdAt: string
		updatedAt: string
	}

	interface User {
		id: number
		role: string
	}

	let user = $state<User | null>(null)
	let items = $state<NewsItem[]>([])
	let loading = $state(true)
	let saving = $state(false)

	let showModal = $state(false)
	let editingItem = $state<NewsItem | null>(null)

	let formTitle = $state('')
	let formContent = $state('')
	let formActive = $state(true)
	let formError = $state<string | null>(null)
	let deleteConfirmId = $state<number | null>(null)

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
			const response = await fetch(`${API_URL}/admin/news`, {
				credentials: 'include'
			})
			if (response.ok) {
				items = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch news:', e)
		} finally {
			loading = false
		}
	}

	function openCreateModal() {
		editingItem = null
		formTitle = ''
		formContent = ''
		formActive = true
		formError = null
		showModal = true
	}

	function openEditModal(item: NewsItem) {
		editingItem = item
		formTitle = item.title
		formContent = item.content
		formActive = item.active
		formError = null
		showModal = true
	}

	function closeModal() {
		showModal = false
		editingItem = null
	}

	async function handleSubmit() {
		if (!formTitle.trim() || !formContent.trim()) {
			formError = 'Title and content are required'
			return
		}

		saving = true
		formError = null

		try {
			const url = editingItem
				? `${API_URL}/admin/news/${editingItem.id}`
				: `${API_URL}/admin/news`

			const response = await fetch(url, {
				method: editingItem ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					title: formTitle,
					content: formContent,
					active: formActive
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
			formError = 'Failed to save news'
		} finally {
			saving = false
		}
	}

	async function toggleActive(item: NewsItem) {
		try {
			const response = await fetch(`${API_URL}/admin/news/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ active: !item.active })
			})
			if (response.ok) {
				await fetchItems()
			}
		} catch (e) {
			console.error('Failed to toggle:', e)
		}
	}

	function requestDelete(id: number) {
		deleteConfirmId = id
	}

	async function confirmDelete() {
		if (!deleteConfirmId) return

		try {
			const response = await fetch(`${API_URL}/admin/news/${deleteConfirmId}`, {
				method: 'DELETE',
				credentials: 'include'
			})
			if (response.ok) {
				await fetchItems()
			}
		} catch (e) {
			console.error('Failed to delete:', e)
		} finally {
			deleteConfirmId = null
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}
</script>

<svelte:head>
	<title>news editor - admin - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-4xl md:text-5xl font-bold mb-2">news</h1>
			<p class="text-lg text-gray-600">manage announcements and updates</p>
		</div>
		<button
			onclick={openCreateModal}
			class="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 cursor-pointer"
		>
			<Plus size={20} />
			add news
		</button>
	</div>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if items.length === 0}
		<div class="text-center py-12 text-gray-500">no news yet</div>
	{:else}
		<div class="grid gap-4">
			{#each items as item}
				<div class="border-4 border-black rounded-2xl p-4 {item.active ? '' : 'opacity-50'}">
					<div class="flex items-start gap-4">
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<h3 class="font-bold text-xl">{item.title}</h3>
								{#if !item.active}
									<span class="px-2 py-0.5 bg-gray-200 rounded-full text-xs font-bold">hidden</span>
								{/if}
							</div>
							<p class="text-gray-600 mb-2">{item.content}</p>
							<p class="text-sm text-gray-400">{formatDate(item.createdAt)}</p>
						</div>
						<div class="flex gap-2 shrink-0">
							<button
								onclick={() => toggleActive(item)}
								class="p-2 border-4 border-black rounded-lg hover:border-dashed transition-all duration-200 cursor-pointer"
								title={item.active ? 'Hide' : 'Show'}
							>
								{#if item.active}
									<EyeOff size={18} />
								{:else}
									<Eye size={18} />
								{/if}
							</button>
							<button
								onclick={() => openEditModal(item)}
								class="p-2 border-4 border-black rounded-lg hover:border-dashed transition-all duration-200 cursor-pointer"
							>
								<Pencil size={18} />
							</button>
							<button
								onclick={() => requestDelete(item.id)}
								class="p-2 border-4 border-red-600 text-red-600 rounded-lg hover:bg-red-50 transition-all duration-200 cursor-pointer"
							>
								<Trash2 size={18} />
							</button>
						</div>
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
				<h2 class="text-2xl font-bold">{editingItem ? 'edit news' : 'add news'}</h2>
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
					<label for="title" class="block text-sm font-bold mb-1">title</label>
					<input
						id="title"
						type="text"
						bind:value={formTitle}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="content" class="block text-sm font-bold mb-1">content</label>
					<textarea
						id="content"
						bind:value={formContent}
						rows="4"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div class="flex items-center gap-2">
					<input
						id="active"
						type="checkbox"
						bind:checked={formActive}
						class="w-5 h-5 border-2 border-black rounded"
					/>
					<label for="active" class="font-bold">active (visible to users)</label>
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

{#if deleteConfirmId}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={(e) => e.target === e.currentTarget && (deleteConfirmId = null)}
		onkeydown={(e) => e.key === 'Escape' && (deleteConfirmId = null)}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
			<h2 class="text-2xl font-bold mb-4">confirm delete</h2>
			<p class="text-gray-600 mb-6">
				are you sure you want to delete this news item? <span class="text-red-600 block mt-2">this action cannot be undone.</span>
			</p>
			<div class="flex gap-3">
				<button
					onclick={() => (deleteConfirmId = null)}
					class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 cursor-pointer"
				>
					cancel
				</button>
				<button
					onclick={confirmDelete}
					class="flex-1 px-4 py-2 bg-red-600 text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 cursor-pointer"
				>
					delete
				</button>
			</div>
		</div>
	</div>
{/if}
