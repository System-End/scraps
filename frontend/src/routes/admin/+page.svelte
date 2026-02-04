<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Users, FolderKanban, Clock, Scale } from '@lucide/svelte';
	import { getUser } from '$lib/auth-client';
	import { API_URL } from '$lib/config';

	interface Stats {
		totalUsers: number;
		totalProjects: number;
		totalHours: number;
		weightedGrants: number;
	}

	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		const user = await getUser();
		if (!user || (user.role !== 'admin' && user.role !== 'reviewer')) {
			goto('/dashboard');
			return;
		}

		try {
			const response = await fetch(`${API_URL}/admin/stats`, {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('Failed to fetch stats');
			stats = await response.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load stats';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>admin info - scraps</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 pt-24 pb-24 md:px-12">
	<h1 class="mb-8 text-4xl font-bold md:text-5xl">admin info</h1>

	{#if loading}
		<div class="py-12 text-center text-gray-500">loading stats...</div>
	{:else if error}
		<div class="py-12 text-center text-red-600">{error}</div>
	{:else if stats}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
			<div class="flex items-center gap-4 rounded-2xl border-4 border-black p-6">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
					<Users size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">total users</p>
					<p class="text-4xl font-bold">{stats.totalUsers.toLocaleString()}</p>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border-4 border-black p-6">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
					<FolderKanban size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">total projects</p>
					<p class="text-4xl font-bold">{stats.totalProjects.toLocaleString()}</p>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border-4 border-black p-6">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
					<Clock size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">total shipped hours</p>
					<p class="text-4xl font-bold">{stats.totalHours.toLocaleString()}h</p>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border-4 border-black p-6">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
					<Scale size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">weighted grants</p>
					<p class="text-4xl font-bold">{stats.weightedGrants.toLocaleString()}</p>
					<p class="text-xs text-gray-400">total hours ÷ 10</p>
				</div>
			</div>
		</div>
	{/if}
</div>
