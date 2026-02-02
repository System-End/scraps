<script lang="ts">
	import { onMount } from 'svelte'
	import { getUser } from '$lib/auth-client'
	import {
		leaderboardStore,
		leaderboardLoading,
		fetchLeaderboard as fetchLeaderboardData
	} from '$lib/stores'
	import { formatHours } from '$lib/utils'

	let sortBy = $state<'hours' | 'scraps'>('scraps')
	let leaderboard = $derived($leaderboardStore[sortBy])

	function setSortBy(value: 'hours' | 'scraps') {
		sortBy = value
		fetchLeaderboardData(value)
	}

	onMount(async () => {
		await getUser()
		fetchLeaderboardData(sortBy)
	})
</script>

<svelte:head>
	<title>leaderboard | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-2">leaderboard</h1>
	<p class="text-lg text-gray-600 mb-8">top scrappers</p>

	<div class="flex gap-2 mb-6">
		<button
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {sortBy === 'scraps'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setSortBy('scraps')}
		>
			scraps
		</button>
		<button
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {sortBy === 'hours'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setSortBy('hours')}
		>
			hours
		</button>
	</div>

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
							<td class="px-4 py-4 text-right text-lg font-bold">{entry.scraps}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
