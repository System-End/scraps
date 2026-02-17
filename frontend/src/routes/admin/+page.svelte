<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Users, FolderKanban, Clock, Scale, Hourglass, ShieldAlert, Coins, XCircle, Download } from '@lucide/svelte';
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

	interface PendingProject {
		id: number;
		name: string;
		image: string | null;
		scrapsAwarded: number;
		hours: number | null;
		hoursOverride: number | null;
		userId: number;
		status: string;
		createdAt: string;
		owner: { id: number; username: string | null; avatar: string | null } | null;
	}

	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let isAdmin = $state(false);

	// Payout state
	let payoutLoading = $state(false);
	let payoutInfo = $state<{ pendingProjects: number; pendingScraps: number; projects: PendingProject[]; nextPayoutDate: string } | null>(null);
	let payoutResult = $state<{ paidCount: number; totalScraps: number } | null>(null);
	let payoutError = $state<string | null>(null);
	let payingOut = $state(false);

	// Reject payout state
	let rejectingProjectId = $state<number | null>(null);
	let rejectReason = $state('');
	let rejectLoading = $state(false);
	let rejectError = $state<string | null>(null);

	// Fix balances state
	let fixingBalances = $state(false);
	let fixResult = $state<{ fixedCount: number; fixed: { userId: number; username: string | null; deficit: number }[] } | null>(null);
	let fixError = $state<string | null>(null);

	async function fetchPayoutInfo() {
		payoutLoading = true;
		try {
			const res = await fetch(`${API_URL}/admin/scraps-payout`, { credentials: 'include' });
			const data = await res.json();
			if (data.error) {
				payoutError = data.error;
			} else {
				payoutInfo = data;
			}
		} catch {
			payoutError = 'Failed to fetch payout info';
		} finally {
			payoutLoading = false;
		}
	}

	async function triggerPayout() {
		payingOut = true;
		payoutResult = null;
		payoutError = null;
		try {
			const res = await fetch(`${API_URL}/admin/scraps-payout`, {
				method: 'POST',
				credentials: 'include'
			});
			const data = await res.json();
			if (data.error) {
				payoutError = data.error;
			} else {
				payoutResult = data;
				// Refresh payout info
				await fetchPayoutInfo();
			}
		} catch {
			payoutError = 'Failed to trigger payout';
		} finally {
			payingOut = false;
		}
	}

	async function rejectPayout(projectId: number) {
		if (!rejectReason.trim()) {
			rejectError = 'A reason is required';
			return;
		}
		rejectLoading = true;
		rejectError = null;
		try {
			const res = await fetch(`${API_URL}/admin/scraps-payout/reject`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ projectId, reason: rejectReason.trim() })
			});
			const data = await res.json();
			if (data.error) {
				rejectError = data.error;
			} else {
				rejectingProjectId = null;
				rejectReason = '';
				// Refresh payout info
				await fetchPayoutInfo();
			}
		} catch {
			rejectError = 'Failed to reject payout';
		} finally {
			rejectLoading = false;
		}
	}

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

	async function downloadExport(endpoint: string, filename: string) {
		try {
			const res = await fetch(`${API_URL}/admin/export/${endpoint}`, {
				credentials: 'include'
			});
			if (!res.ok) return;
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			console.error('Export failed:', e);
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

		if (isAdmin) {
			await fetchPayoutInfo();
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

<div class="mx-auto max-w-4xl px-6 pb-12 md:px-12">
	<h2 class="mb-4 text-2xl font-bold">exports</h2>
	<div class="rounded-2xl border-4 border-black p-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h3 class="flex items-center gap-2 text-lg font-bold">
					<Download size={20} />
					YSWS export
				</h3>
				<p class="text-sm text-gray-500">download shipped projects for YSWS fraud checking</p>
			</div>
			<div class="flex gap-3">
				<button
					onclick={() => downloadExport('shipped-csv', 'scraps-shipped-projects.csv')}
					class="cursor-pointer rounded-full border-4 border-black px-4 py-2 font-bold transition-all duration-200 hover:border-dashed"
				>
					CSV
				</button>
				<button
					onclick={() => downloadExport('ysws-json', 'scraps-ysws.json')}
					class="cursor-pointer rounded-full border-4 border-black px-4 py-2 font-bold transition-all duration-200 hover:border-dashed"
				>
					JSON
				</button>
			</div>
		</div>
	</div>
</div>

{#if isAdmin}
	<div class="mx-auto max-w-4xl px-6 pb-24 md:px-12">
		<h2 class="mb-4 text-2xl font-bold">admin actions</h2>

		<!-- Scraps Payout -->
		<div class="mb-6 rounded-2xl border-4 border-black p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 class="flex items-center gap-2 text-lg font-bold">
						<Coins size={20} />
						scraps payout
					</h3>
					<p class="text-sm text-gray-500">
						manually pay out all pending scraps right now (normally happens every 2 days at midnight UTC)
					</p>
					{#if payoutInfo}
						<p class="mt-1 text-sm text-gray-600">
							<span class="font-bold">{payoutInfo.pendingProjects}</span> pending project{payoutInfo.pendingProjects !== 1 ? 's' : ''}
							· <span class="font-bold">{payoutInfo.pendingScraps}</span> scraps to pay out
						</p>
						<p class="mt-0.5 text-xs text-gray-400">
							next auto-payout: {new Date(payoutInfo.nextPayoutDate).toLocaleString()}
						</p>
					{/if}
				</div>
				<button
					onclick={triggerPayout}
					disabled={payingOut || (payoutInfo?.pendingProjects === 0)}
					class="cursor-pointer rounded-full bg-green-600 px-6 py-2 font-bold text-white transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{payingOut ? 'paying out...' : 'pay out now'}
				</button>
			</div>

			{#if payoutError}
				<div class="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{payoutError}</div>
			{/if}

			{#if payoutResult}
				<div class="mt-4 rounded-lg bg-green-50 p-4">
					<p class="font-bold text-green-700">
						paid out {payoutResult.totalScraps} scraps across {payoutResult.paidCount} project{payoutResult.paidCount !== 1 ? 's' : ''}
					</p>
				</div>
			{/if}

			<!-- Pending Projects Preview -->
			{#if payoutInfo && payoutInfo.projects && payoutInfo.projects.length > 0}
				<div class="mt-6">
					<h4 class="mb-3 text-sm font-bold text-gray-500 uppercase">pending payout projects</h4>
					<div class="space-y-3 max-h-96 overflow-y-auto">
						{#each payoutInfo.projects as project}
							<div class="flex items-center gap-4 rounded-xl border-2 border-gray-200 bg-gray-50 p-4 transition-all hover:border-gray-300">
								{#if project.image}
									<img src={project.image} alt={project.name} class="h-12 w-12 rounded-lg border-2 border-black object-cover" />
								{:else}
									<div class="h-12 w-12 rounded-lg border-2 border-gray-300 bg-gray-200"></div>
								{/if}
								<div class="flex-1 min-w-0">
									<a href="/projects/{project.id}" class="font-bold hover:underline truncate block">{project.name}</a>
									<div class="flex items-center gap-2 text-sm text-gray-500">
										{#if project.owner}
											<a href="/users/{project.owner.id}" class="hover:underline">
												{project.owner.username ?? `User #${project.owner.id}`}
											</a>
											<span>·</span>
										{/if}
										<span>{(project.hoursOverride ?? project.hours ?? 0).toFixed(1)}h</span>
										<span>·</span>
										<span class="font-bold text-green-600">{project.scrapsAwarded} scraps</span>
									</div>
								</div>
								<div class="flex items-center gap-2 shrink-0">
									{#if rejectingProjectId === project.id}
										<div class="flex items-center gap-2">
											<input
												type="text"
												bind:value={rejectReason}
												placeholder="reason for rejection..."
												class="rounded-lg border-2 border-gray-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none w-48"
												onkeydown={(e) => e.key === 'Enter' && rejectPayout(project.id)}
											/>
											<button
												onclick={() => rejectPayout(project.id)}
												disabled={rejectLoading || !rejectReason.trim()}
												class="cursor-pointer rounded-full bg-red-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												{rejectLoading ? '...' : 'reject'}
											</button>
											<button
												onclick={() => { rejectingProjectId = null; rejectReason = ''; rejectError = null; }}
												class="cursor-pointer rounded-full border-2 border-gray-300 px-3 py-1.5 text-sm font-bold text-gray-600 hover:border-gray-400"
											>
												cancel
											</button>
										</div>
									{:else}
										<button
											onclick={() => { rejectingProjectId = project.id; rejectReason = ''; rejectError = null; }}
											class="cursor-pointer flex items-center gap-1 rounded-full border-2 border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 transition-all hover:bg-red-50 hover:border-red-400"
											title="Reject payout for this project"
										>
											<XCircle size={14} />
											reject
										</button>
									{/if}
								</div>
							</div>
							{#if rejectError && rejectingProjectId === project.id}
								<div class="ml-16 rounded-lg bg-red-50 p-2 text-xs text-red-600">{rejectError}</div>
							{/if}
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Fix Negative Balances -->
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
