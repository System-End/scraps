<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ArrowLeft, Package, Clock, CheckCircle, XCircle, AlertTriangle, Plus, Gift } from '@lucide/svelte'
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

	interface Bonus {
		id: number
		amount: number
		reason: string
		givenBy: number | null
		givenByUsername: string | null
		createdAt: string
	}

	let currentUser = $state<CurrentUser | null>(null)
	let targetUser = $state<TargetUser | null>(null)
	let projects = $state<Project[]>([])
	let stats = $state<UserStats | null>(null)
	let bonuses = $state<Bonus[]>([])
	let loading = $state(true)
	let saving = $state(false)
	let editingNotes = $state('')
	let editingRole = $state('')

	let showBonusModal = $state(false)
	let bonusAmount = $state<number | null>(null)
	let bonusReason = $state('')
	let savingBonus = $state(false)
	let bonusError = $state<string | null>(null)

	onMount(async () => {
		currentUser = await getUser()
		if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'reviewer')) {
			goto('/dashboard')
			return
		}

		try {
			const [userResponse, bonusesResponse] = await Promise.all([
				fetch(`${API_URL}/admin/users/${data.id}`, { credentials: 'include' }),
				currentUser.role === 'admin'
					? fetch(`${API_URL}/admin/users/${data.id}/bonuses`, { credentials: 'include' })
					: Promise.resolve(null)
			])

			if (userResponse.ok) {
				const result = await userResponse.json()
				targetUser = result.user
				projects = result.projects || []
				stats = result.stats
				editingNotes = result.user?.internalNotes || ''
				editingRole = result.user?.role || 'member'
			}

			if (bonusesResponse?.ok) {
				bonuses = await bonusesResponse.json()
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

	async function saveBonus() {
		if (!targetUser || !bonusAmount || !bonusReason.trim()) return
		savingBonus = true
		bonusError = null

		try {
			const response = await fetch(`${API_URL}/admin/users/${targetUser.id}/bonus`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ amount: bonusAmount, reason: bonusReason.trim() })
			})

			const result = await response.json()

			if (!response.ok) {
				throw new Error(result.error || 'Failed to save bonus')
			}

			bonuses = [
				{
					...result,
					givenByUsername: currentUser?.id === result.givenBy ? 'you' : null
				},
				...bonuses
			]
			targetUser.scraps += bonusAmount
			showBonusModal = false
			bonusAmount = null
			bonusReason = ''
		} catch (e) {
			bonusError = e instanceof Error ? e.message : 'Failed to save bonus'
		} finally {
			savingBonus = false
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
					{#if currentUser?.role === 'admin'}
						<button
							onclick={() => (showBonusModal = true)}
							class="mt-2 px-3 py-1 bg-green-500 text-white rounded-full text-sm font-bold hover:bg-green-600 transition-all cursor-pointer flex items-center gap-1"
						>
							<Plus size={14} />
							give bonus
						</button>
					{/if}
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

		<!-- Bonuses (admin only) -->
		{#if currentUser?.role === 'admin'}
			<div class="border-4 border-black rounded-2xl p-6 mt-6 bg-green-50">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-bold flex items-center gap-2">
						<Gift size={20} />
						bonus history ({bonuses.length})
					</h2>
				</div>
				{#if bonuses.length === 0}
					<p class="text-gray-500">no bonuses given yet</p>
				{:else}
					<div class="space-y-3">
						{#each bonuses as bonus}
							<div class="p-3 bg-white border-2 border-black rounded-lg">
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<p class="font-bold text-lg {bonus.amount >= 0 ? 'text-green-600' : 'text-red-600'}">
											{bonus.amount >= 0 ? '+' : ''}{bonus.amount} scraps
										</p>
										<p class="text-sm text-gray-700">{bonus.reason}</p>
									</div>
									<div class="text-right text-xs text-gray-500">
										<p>{new Date(bonus.createdAt).toLocaleDateString()}</p>
										<p>by @{bonus.givenByUsername || 'unknown'}</p>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Bonus Modal -->
{#if showBonusModal}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={(e) => e.target === e.currentTarget && (showBonusModal = false)}
		onkeydown={(e) => e.key === 'Escape' && (showBonusModal = false)}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
			<h2 class="text-2xl font-bold mb-4">give bonus scraps</h2>

			{#if bonusError}
				<div class="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-sm">
					{bonusError}
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="bonusAmount" class="block text-sm font-bold mb-1">amount <span class="text-red-500">*</span></label>
					<input
						id="bonusAmount"
						type="number"
						bind:value={bonusAmount}
						placeholder="e.g. 100 or -50"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
					<p class="text-xs text-gray-500 mt-1">use negative numbers to deduct scraps</p>
				</div>

				<div>
					<label for="bonusReason" class="block text-sm font-bold mb-1">reason <span class="text-red-500">*</span></label>
					<textarea
						id="bonusReason"
						bind:value={bonusReason}
						rows="3"
						placeholder="why are you giving this bonus?"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={() => (showBonusModal = false)}
					disabled={savingBonus}
					class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
				>
					cancel
				</button>
				<button
					onclick={saveBonus}
					disabled={savingBonus || !bonusAmount || !bonusReason.trim()}
					class="flex-1 px-4 py-2 bg-green-500 text-white rounded-full font-bold hover:bg-green-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{savingBonus ? 'saving...' : 'give bonus'}
				</button>
			</div>
		</div>
	</div>
{/if}
