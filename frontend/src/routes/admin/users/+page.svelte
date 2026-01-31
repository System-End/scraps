<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ChevronLeft, ChevronRight } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface AdminUser {
		id: number
		username: string | null
		email?: string
		avatar: string | null
		slackId: string | null
		scraps: number
		role: string
		internalNotes: string | null
		createdAt: string
	}

	interface Pagination {
		page: number
		limit: number
		total: number
		totalPages: number
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

	let user = $state<User | null>(null)
	let users = $state<AdminUser[]>([])
	let pagination = $state<Pagination | null>(null)
	let loading = $state(true)
	let screws = $derived(user?.scraps ?? 0)
	let editingUser = $state<AdminUser | null>(null)
	let editingNotes = $state('')
	let editingRole = $state('')
	let saving = $state(false)

	onMount(async () => {
		user = await getUser()
		if (!user || (user.role !== 'admin' && user.role !== 'reviewer')) {
			goto('/dashboard')
			return
		}

		await fetchUsers()
	})

	async function fetchUsers(page = 1) {
		loading = true
		try {
			const response = await fetch(`${API_URL}/admin/users?page=${page}&limit=20`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				users = data.data || []
				pagination = data.pagination
			}
		} catch (e) {
			console.error('Failed to fetch users:', e)
		} finally {
			loading = false
		}
	}

	function goToPage(page: number) {
		fetchUsers(page)
	}

	function startEditing(u: AdminUser) {
		editingUser = u
		editingNotes = u.internalNotes || ''
		editingRole = u.role
	}

	function cancelEditing() {
		editingUser = null
		editingNotes = ''
		editingRole = ''
	}

	async function saveChanges() {
		if (!editingUser) return
		saving = true

		try {
			// Save notes
			await fetch(`${API_URL}/admin/users/${editingUser.id}/notes`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ internalNotes: editingNotes })
			})

			// Save role if admin
			if (user?.role === 'admin' && editingRole !== editingUser.role) {
				await fetch(`${API_URL}/admin/users/${editingUser.id}/role`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ role: editingRole })
				})
			}

			await fetchUsers()
			cancelEditing()
		} catch (e) {
			console.error('Failed to save:', e)
		} finally {
			saving = false
		}
	}

	function getRoleBadgeColor(role: string) {
		switch (role) {
			case 'admin':
				return 'bg-red-100 text-red-700'
			case 'reviewer':
				return 'bg-blue-100 text-blue-700'
			default:
				return 'bg-gray-100 text-gray-700'
		}
	}
</script>

<svelte:head>
	<title>users | admin | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-4xl md:text-5xl font-bold mb-2">users</h1>
			<p class="text-lg text-gray-600">manage users and permissions</p>
		</div>
		<a
			href="/admin/reviews"
			class="px-4 py-2 border-2 border-black rounded-full font-bold hover:border-dashed transition-all"
		>
			reviews
		</a>
	</div>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else}
		<div class="border-4 border-black rounded-2xl overflow-hidden">
			<table class="w-full">
				<thead>
					<tr class="border-b-4 border-black bg-black text-white">
						<th class="px-4 py-4 text-left font-bold">user</th>
						{#if user?.role === 'admin'}
							<th class="px-4 py-4 text-left font-bold">email</th>
						{/if}
						<th class="px-4 py-4 text-center font-bold">role</th>
						<th class="px-4 py-4 text-center font-bold">scraps</th>
						<th class="px-4 py-4 text-right font-bold">actions</th>
					</tr>
				</thead>
				<tbody>
					{#each users as u (u.id)}
						<tr class="border-b-2 border-black/20 last:border-b-0 hover:bg-gray-50">
							<td class="px-4 py-4">
								<div class="flex items-center gap-3">
									{#if u.avatar}
										<img
											src={u.avatar}
											alt=""
											class="w-10 h-10 rounded-full object-cover border-2 border-black"
										/>
									{:else}
										<div class="w-10 h-10 rounded-full bg-gray-200 border-2 border-black"></div>
									{/if}
									<span class="font-bold">{u.username || 'unknown'}</span>
								</div>
							</td>
							{#if user?.role === 'admin'}
								<td class="px-4 py-4 text-gray-600">{u.email || '-'}</td>
							{/if}
							<td class="px-4 py-4 text-center">
								<span class="px-3 py-1 rounded-full text-sm font-bold {getRoleBadgeColor(u.role)}">
									{u.role}
								</span>
							</td>
							<td class="px-4 py-4 text-center font-bold">{u.scraps}</td>
							<td class="px-4 py-4 text-right">
								<button
									onclick={() => startEditing(u)}
									class="px-3 py-1 border-2 border-black rounded-full font-bold text-sm hover:border-dashed transition-all"
								>
									edit
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if pagination && pagination.totalPages > 1}
			<div class="flex items-center justify-center gap-4 mt-8">
				<button
					onclick={() => goToPage(pagination!.page - 1)}
					disabled={pagination.page <= 1}
					class="p-2 border-2 border-black rounded-full hover:border-dashed transition-all disabled:opacity-30 disabled:cursor-not-allowed"
				>
					<ChevronLeft size={20} />
				</button>
				<span class="font-bold">
					page {pagination.page} of {pagination.totalPages}
				</span>
				<button
					onclick={() => goToPage(pagination!.page + 1)}
					disabled={pagination.page >= pagination.totalPages}
					class="p-2 border-2 border-black rounded-full hover:border-dashed transition-all disabled:opacity-30 disabled:cursor-not-allowed"
				>
					<ChevronRight size={20} />
				</button>
			</div>
		{/if}
	{/if}
</div>

<!-- Edit Modal -->
{#if editingUser}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={(e) => e.target === e.currentTarget && cancelEditing()}
		onkeydown={(e) => e.key === 'Escape' && cancelEditing()}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black">
			<h2 class="text-2xl font-bold mb-6">edit user: {editingUser.username || 'unknown'}</h2>

			<div class="space-y-4">
				{#if user?.role === 'admin'}
					<div>
						<label class="block text-sm font-bold mb-1">role</label>
						<select
							bind:value={editingRole}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						>
							<option value="member">member</option>
							<option value="reviewer">reviewer</option>
							<option value="admin">admin</option>
						</select>
					</div>
				{/if}

				<div>
					<label class="block text-sm font-bold mb-1">internal notes</label>
					<textarea
						bind:value={editingNotes}
						rows="4"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={cancelEditing}
					disabled={saving}
					class="flex-1 px-4 py-2 border-2 border-black rounded-full font-bold hover:border-dashed transition-all disabled:opacity-50"
				>
					cancel
				</button>
				<button
					onclick={saveChanges}
					disabled={saving}
					class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
				>
					{saving ? 'saving...' : 'save'}
				</button>
			</div>
		</div>
	</div>
{/if}
