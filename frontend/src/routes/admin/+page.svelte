<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { Users, FolderKanban, Clock, Scale } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface Stats {
		totalUsers: number
		totalProjects: number
		totalHours: number
		weightedGrants: number
	}

	let stats = $state<Stats | null>(null)
	let loading = $state(true)
	let error = $state<string | null>(null)

	onMount(async () => {
		const user = await getUser()
		if (!user || (user.role !== 'admin' && user.role !== 'reviewer')) {
			goto('/dashboard')
			return
		}

		try {
			const response = await fetch(`${API_URL}/admin/stats`, {
				credentials: 'include'
			})
			if (!response.ok) throw new Error('Failed to fetch stats')
			stats = await response.json()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stats'
		} finally {
			loading = false
		}
	})
</script>

<svelte:head>
	<title>admin info - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-8">admin info</h1>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading stats...</div>
	{:else if error}
		<div class="text-center py-12 text-red-600">{error}</div>
	{:else if stats}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="border-4 border-black rounded-2xl p-6 flex items-center gap-4">
				<div class="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center">
					<Users size={32} />
				</div>
				<div>
					<p class="text-sm text-gray-500 font-bold">total users</p>
					<p class="text-4xl font-bold">{stats.totalUsers.toLocaleString()}</p>
				</div>
			</div>

			<div class="border-4 border-black rounded-2xl p-6 flex items-center gap-4">
				<div class="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center">
					<FolderKanban size={32} />
				</div>
				<div>
					<p class="text-sm text-gray-500 font-bold">total projects</p>
					<p class="text-4xl font-bold">{stats.totalProjects.toLocaleString()}</p>
				</div>
			</div>

			<div class="border-4 border-black rounded-2xl p-6 flex items-center gap-4">
				<div class="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center">
					<Clock size={32} />
				</div>
				<div>
					<p class="text-sm text-gray-500 font-bold">total shipped hours</p>
					<p class="text-4xl font-bold">{stats.totalHours.toLocaleString()}h</p>
				</div>
			</div>

			<div class="border-4 border-black rounded-2xl p-6 flex items-center gap-4">
				<div class="w-16 h-16 bg-black text-white rounded-full flex items-center justify-center">
					<Scale size={32} />
				</div>
				<div>
					<p class="text-sm text-gray-500 font-bold">weighted grants</p>
					<p class="text-4xl font-bold">{stats.weightedGrants.toLocaleString()}</p>
					<p class="text-xs text-gray-400">total hours ÷ 10</p>
				</div>
			</div>
		</div>
	{/if}
</div>
