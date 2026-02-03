<script lang="ts">
	import { onMount } from 'svelte'
	import { getUser } from '$lib/auth-client'
	import {
		leaderboardStore,
		leaderboardLoading,
		fetchLeaderboard as fetchLeaderboardData,
		probabilityLeadersStore,
		probabilityLeadersLoading,
		fetchProbabilityLeaders
	} from '$lib/stores'
	import { formatHours } from '$lib/utils'

	let activeTab = $state<'scraps' | 'hours' | 'probability'>('scraps')
	let sortBy = $derived(activeTab === 'probability' ? 'scraps' : activeTab)
	let leaderboard = $derived($leaderboardStore[sortBy as 'scraps' | 'hours'])
	let probabilityLeaders = $derived($probabilityLeadersStore)

	function setActiveTab(value: 'scraps' | 'hours' | 'probability') {
		activeTab = value
		if (value === 'probability') {
			fetchProbabilityLeaders()
		} else {
			fetchLeaderboardData(value)
		}
	}

	onMount(async () => {
		await getUser()
		fetchLeaderboardData('scraps')
	})
</script>

<svelte:head>
	<title>leaderboard - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-2">leaderboard</h1>
	<p class="text-lg text-gray-600 mb-8">top scrappers</p>

	<div class="flex gap-2 mb-6 flex-wrap">
		<button
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {activeTab === 'scraps'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setActiveTab('scraps')}
		>
			scraps
		</button>
		<button
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {activeTab === 'hours'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setActiveTab('hours')}
		>
			hours
		</button>
		<button
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {activeTab === 'probability'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setActiveTab('probability')}
		>
			probability leaders
		</button>
	</div>

	{#if activeTab === 'probability'}
		<div class="border-4 border-black rounded-2xl p-6">
			{#if $probabilityLeadersLoading && probabilityLeaders.length === 0}
				<div class="text-center text-gray-500">loading...</div>
			{:else if probabilityLeaders.length === 0}
				<div class="text-center text-gray-500">no probability leaders yet</div>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each probabilityLeaders as leader (leader.itemId)}
						<div class="border-4 border-black rounded-2xl p-4 hover:border-dashed transition-all">
							<div class="flex items-center gap-3 mb-3">
								<img
									src={leader.itemImage}
									alt={leader.itemName}
									class="w-12 h-12 rounded-lg object-cover border-2 border-black"
								/>
								<div>
									<div class="font-bold">{leader.itemName}</div>
									<div class="text-sm text-gray-500">base: {leader.baseProbability}%</div>
								</div>
							</div>
							{#if leader.topUser}
								<a href="/users/{leader.topUser.id}" class="flex items-center gap-2 group">
									<img
										src={leader.topUser.avatar}
										alt={leader.topUser.username}
										class="w-8 h-8 rounded-full object-cover border-2 border-black"
									/>
									<span class="font-bold group-hover:underline">{leader.topUser.username}</span>
									<span class="ml-auto font-bold text-green-600">{leader.effectiveProbability}%</span>
								</a>
							{:else}
								<div class="text-gray-500 text-sm">no boosts yet</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="border-4 border-black rounded-2xl overflow-hidden">
			{#if $leaderboardLoading && leaderboard.length === 0}
				<div class="p-8 text-center text-gray-500">loading...</div>
			{:else}
				<table class="w-full">
					<thead>
						<tr class="border-b-4 border-black bg-black text-white">
							<th class="px-4 py-4 text-left font-bold">rank</th>
							<th class="px-4 py-4 text-left font-bold">user</th>
							<th class="px-4 py-4 text-right font-bold">hours</th>
							<th class="px-4 py-4 text-right font-bold">projects</th>
							<th class="px-4 py-4 text-right font-bold">scraps</th>
						</tr>
					</thead>
					<tbody>
						{#each leaderboard as entry (entry.id)}
							<tr
								class="border-b-2 border-black/20 last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
								onclick={() => window.location.href = `/users/${entry.id}`}
							>
								<td class="px-4 py-4 font-bold text-2xl">
									{#if entry.rank === 1}
										🥇
									{:else if entry.rank === 2}
										🥈
									{:else if entry.rank === 3}
										🥉
									{:else}
										{entry.rank}
									{/if}
								</td>
								<td class="px-4 py-4">
									<a href="/users/{entry.id}" class="flex items-center gap-3">
										<img
											src={entry.avatar}
											alt={entry.username}
											class="w-10 h-10 rounded-full object-cover border-2 border-black"
										/>
										<span class="font-bold text-lg hover:underline">{entry.username}</span>
									</a>
								</td>
								<td class="px-4 py-4 text-right text-lg">{formatHours(entry.hours)}h</td>
								<td class="px-4 py-4 text-right text-lg">{entry.projectCount}</td>
								<td class="px-4 py-4 text-right text-lg">
									<span class="font-bold">{entry.scraps}</span>
									<span class="text-gray-500 text-sm ml-1">(earned: {entry.scrapsEarned})</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>
