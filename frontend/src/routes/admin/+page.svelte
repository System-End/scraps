<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Users, FolderKanban, Clock, Scale, Hourglass, ShieldAlert } from '@lucide/svelte';
	import { getUser } from '$lib/auth-client';
	import { API_URL } from '$lib/config';
	import { t } from '$lib/i18n';

	interface Stats {
		totalUsers: number;
		totalProjects: number;
		totalHours: number;
		weightedGrants: number;
		pendingHours: number;
		pendingWeightedGrants: number;
		inProgressHours: number;
		inProgressWeightedGrants: number;
	}

	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let isAdmin = $state(false);
	let fixingBalances = $state(false);
	let fixResult = $state<{ fixedCount: number; fixed: { userId: number; username: string | null; deficit: number }[] } | null>(null);
	let fixError = $state<string | null>(null);

	async function fixNegativeBalances() {
		fixingBalances = true;
		fixResult = null;
		fixError = null;
		try {
			const res = await fetch(`${API_URL}/admin/fix-negative-balances`, {
				method: 'POST',
				credentials: 'include'
			});
			const data = await res.json();
			if (data.error) {
				fixError = data.error;
			} else {
				fixResult = data;
			}
		} catch (e) {
			fixError = 'Failed to fix negative balances';
		} finally {
			fixingBalances = false;
		}
	}

	onMount(async () => {
		const user = await getUser();
		if (!user || (user.role !== 'admin' && user.role !== 'reviewer')) {
			goto('/dashboard');
			return;
		}
		isAdmin = user.role === 'admin';

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
	<title>{$t.admin.adminInfo} - scraps</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 pt-24 pb-24 md:px-12">
	<h1 class="mb-8 text-4xl font-bold md:text-5xl">{$t.admin.adminInfo}</h1>

	{#if loading}
		<div class="py-12 text-center text-gray-500">{$t.admin.loadingStats}</div>
	{:else if error}
		<div class="py-12 text-center text-red-600">{$t.common.error}: {error}</div>
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

			<div class="flex items-center gap-4 rounded-2xl border-4 border-yellow-500 bg-yellow-50 p-6">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500 text-white"
				>
					<Hourglass size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">in progress hours</p>
					<p class="text-4xl font-bold text-yellow-600">
						{stats.inProgressHours.toLocaleString()}h
					</p>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border-4 border-yellow-500 bg-yellow-50 p-6">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500 text-white"
				>
					<Scale size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">in progress weighted grants</p>
					<p class="text-4xl font-bold text-yellow-600">
						{stats.inProgressWeightedGrants.toLocaleString()}
					</p>
					<p class="text-xs text-gray-400">in progress hours ÷ 10</p>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border-4 border-blue-500 bg-blue-50 p-6">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white">
					<Hourglass size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">pending review hours</p>
					<p class="text-4xl font-bold text-blue-600">{stats.pendingHours.toLocaleString()}h</p>
				</div>
			</div>

			<div class="flex items-center gap-4 rounded-2xl border-4 border-blue-500 bg-blue-50 p-6">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500 text-white">
					<Scale size={32} />
				</div>
				<div>
					<p class="text-sm font-bold text-gray-500">pending weighted grants</p>
					<p class="text-4xl font-bold text-blue-600">
						{stats.pendingWeightedGrants.toLocaleString()}
					</p>
					<p class="text-xs text-gray-400">pending hours ÷ 10</p>
				</div>
			</div>
		</div>
	{/if}
</div>

{#if isAdmin}
	<div class="mx-auto max-w-4xl px-6 pb-24 md:px-12">
		<h2 class="mb-4 text-2xl font-bold">admin actions</h2>
		<div class="rounded-2xl border-4 border-black p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="flex items-center gap-2 text-lg font-bold">
						<ShieldAlert size={20} />
						fix negative balances
					</h3>
					<p class="text-sm text-gray-500">
						gives a bonus to all users with negative scraps balance to bring them to 0
					</p>
				</div>
				<button
					onclick={fixNegativeBalances}
					disabled={fixingBalances}
					class="cursor-pointer rounded-full bg-red-600 px-6 py-2 font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
				>
					{fixingBalances ? 'running...' : 'run fix'}
				</button>
			</div>

			{#if fixError}
				<div class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{fixError}</div>
			{/if}

			{#if fixResult}
				<div class="mt-4 rounded-lg bg-green-50 p-4">
					<p class="font-bold text-green-700">
						fixed {fixResult.fixedCount} user{fixResult.fixedCount !== 1 ? 's' : ''}
					</p>
					{#if fixResult.fixed.length > 0}
						<ul class="mt-2 space-y-1 text-sm text-green-800">
							{#each fixResult.fixed as u}
								<li>
									<span class="font-medium">{u.username ?? `User #${u.userId}`}</span>
									— awarded {u.deficit} scraps
								</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-1 text-sm text-green-600">no users had negative balances</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
