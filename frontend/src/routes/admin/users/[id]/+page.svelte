<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ArrowLeft, Package, Clock, CheckCircle, XCircle, AlertTriangle } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'

	let { data } = $props()

	interface Project {
		id: number
		name: string
		status: string
		hours: number
		hoursOverride: number | null
		createdAt: string
		updatedAt: string
		deleted: number | null
	}

	interface UserStats {
		total: number
		shipped: number
		inProgress: number
		waitingForReview: number
		rejected: number
		totalHours: number
	}

	interface TargetUser {
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

	interface CurrentUser {
		id: number
		role: string
	}

	let currentUser = $state<CurrentUser | null>(null)
	let targetUser = $state<TargetUser | null>(null)
	let projects = $state<Project[]>([])
	let stats = $state<UserStats | null>(null)
	let loading = $state(true)
	let saving = $state(false)
	let editingNotes = $state('')
	let editingRole = $state('')

	onMount(async () => {
		currentUser = await getUser()
		if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'reviewer')) {
			goto('/dashboard')
			return
		}

		try {
			const response = await fetch(`${API_URL}/admin/users/${data.id}`, {
				credentials: 'include'
			})
			if (response.ok) {
				const result = await response.json()
				targetUser = result.user
				projects = result.projects || []
				stats = result.stats
				editingNotes = result.user?.internalNotes || ''
				editingRole = result.user?.role || 'member'
			}
		} catch (e) {
			console.error('Failed to fetch user:', e)
		} finally {
			loading = false
		}
	})

	async function saveChanges() {
		if (!targetUser) return
		saving = true

		try {
			await fetch(`${API_URL}/admin/users/${targetUser.id}/notes`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ internalNotes: editingNotes })
			})

			if (currentUser?.role === 'admin' && editingRole !== targetUser.role) {
				await fetch(`${API_URL}/admin/users/${targetUser.id}/role`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ role: editingRole })
				})
				targetUser.role = editingRole
			}

			targetUser.internalNotes = editingNotes
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
			case 'banned':
				return 'bg-black text-white'
			default:
				return 'bg-gray-100 text-gray-700'
		}
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'shipped':
				return CheckCircle
			case 'waiting_for_review':
				return Clock
			case 'in_progress':
				return AlertTriangle
			case 'permanently_rejected':
				return XCircle
			default:
				return Package
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'shipped':
				return 'text-green-600'
			case 'waiting_for_review':
			case 'in_progress':
				return 'text-yellow-600'
			case 'permanently_rejected':
				return 'text-red-600'
			default:
				return 'text-gray-600'
		}
	}

	function getStatusTag(status: string) {
		switch (status) {
			case 'shipped':
				return { label: 'approved', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-600' }
			case 'in_progress':
			case 'waiting_for_review':
				return { label: 'in progress', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-600' }
			case 'permanently_rejected':
				return { label: 'permanently rejected', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-600' }
			default:
				return { label: status.replace(/_/g, ' '), bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-600' }
		}
	}
</script>

<svelte:head>
	<title>{targetUser?.username || 'user'} - admin - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	<a
		href="/admin/users"
		class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
	>
		<ArrowLeft size={20} />
		back to users
	</a>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if !targetUser}
		<div class="text-center py-12 text-gray-500">user not found</div>
	{:else}
		<!-- User Header -->
		<div class="border-4 border-black rounded-2xl p-6 mb-6">
			<div class="flex items-start gap-6">
				{#if targetUser.avatar}
					<img
						src={targetUser.avatar}
						alt=""
						class="w-20 h-20 rounded-full border-4 border-black"
					/>
				{:else}
					<div class="w-20 h-20 rounded-full bg-gray-200 border-4 border-black"></div>
				{/if}
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-2">
						<h1 class="text-3xl font-bold">{targetUser.username || 'unknown'}</h1>
						<span class="px-3 py-1 rounded-full text-sm font-bold {getRoleBadgeColor(targetUser.role)}">
							{targetUser.role}
						</span>
					</div>
					{#if targetUser.email}
						<p class="text-gray-600 mb-2">{targetUser.email}</p>
					{/if}
					<div class="flex items-center gap-4 text-sm text-gray-500">
						<span>joined {new Date(targetUser.createdAt).toLocaleDateString()}</span>
						{#if targetUser.slackId}
							<span>slack: {targetUser.slackId}</span>
						{/if}
					</div>
				</div>
				<div class="text-right">
					<p class="text-4xl font-bold">{targetUser.scraps}</p>
					<p class="text-sm text-gray-500">scraps</p>
				</div>
			</div>
		</div>

		<!-- Stats -->
		{#if stats}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold">{stats.total}</p>
					<p class="text-sm text-gray-500">total projects</p>
				</div>
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold text-green-600">{stats.shipped}</p>
					<p class="text-sm text-gray-500">shipped</p>
				</div>
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold text-yellow-600">{stats.waitingForReview}</p>
					<p class="text-sm text-gray-500">pending review</p>
				</div>
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold">{formatHours(stats.totalHours)}h</p>
					<p class="text-sm text-gray-500">total hours</p>
				</div>
			</div>
		{/if}

		<!-- Internal Notes & Role -->
		<div class="border-4 border-black rounded-2xl p-6 mb-6 bg-yellow-50">
			<h2 class="text-xl font-bold mb-4">admin settings</h2>
			<div class="space-y-4">
				{#if currentUser?.role === 'admin'}
					<div>
						<label for="role" class="block text-sm font-bold mb-1">role</label>
						<select
							id="role"
							bind:value={editingRole}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed bg-white"
						>
							<option value="member">member</option>
							<option value="reviewer">reviewer</option>
							<option value="admin">admin</option>
							<option value="banned">banned</option>
						</select>
						{#if editingRole === 'banned'}
							<p class="text-xs text-red-600 mt-1 flex items-center gap-1">
								<AlertTriangle size={12} />
								banning will redirect this user to fraud.land on login
							</p>
						{/if}
					</div>
				{/if}

				<div>
					<label for="notes" class="block text-sm font-bold mb-1">internal notes</label>
					<textarea
						id="notes"
						bind:value={editingNotes}
						rows="4"
						placeholder="Notes about this user (visible to reviewers only)"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none bg-white"
					></textarea>
				</div>

				<button
					onclick={saveChanges}
					disabled={saving}
					class="px-6 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all disabled:opacity-50 cursor-pointer"
				>
					{saving ? 'saving...' : 'save changes'}
				</button>
			</div>
		</div>

		<!-- Projects -->
		<div class="border-4 border-black rounded-2xl p-6">
			<h2 class="text-xl font-bold mb-4">projects ({projects.length})</h2>
			{#if projects.length === 0}
				<p class="text-gray-500">no projects yet</p>
			{:else}
				<div class="space-y-3">
					{#each projects as project}
						{@const StatusIcon = getStatusIcon(project.status)}
						{@const statusTag = getStatusTag(project.status)}
						<a
							href="/admin/reviews/{project.id}"
							class="flex items-center justify-between p-4 border-2 border-black rounded-lg hover:border-dashed transition-all duration-200 cursor-pointer {project.deleted ? 'opacity-50' : ''}"
						>
							<div class="flex items-center gap-3">
								<StatusIcon size={20} class={getStatusColor(project.status)} />
								<div>
									<p class="font-bold">
										{project.name}
										{#if project.deleted}
											<span class="text-red-500 text-xs font-normal ml-2">(deleted)</span>
										{/if}
									</p>
									<p class="text-xs text-gray-500">
										{formatHours(project.hoursOverride ?? project.hours)}h
									</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								{#if project.deleted}
									<span class="px-2 py-1 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-500">
										deleted
									</span>
								{:else}
									<span class="px-2 py-1 rounded-full text-xs font-bold border {statusTag.bg} {statusTag.text} {statusTag.border}">
										{statusTag.label}
									</span>
								{/if}
								<span class="text-xs text-gray-500">
									{new Date(project.updatedAt).toLocaleDateString()}
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
