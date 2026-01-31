<script lang="ts">
	import { onMount } from 'svelte'
	import { API_URL } from '$lib/config'
	import { getUser } from '$lib/auth-client'

	interface LeaderboardEntry {
		rank: number
		id: number
		username: string
		avatar: string
		hours: number
		scraps: number
		projectCount: number
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

	let leaderboard = $state<LeaderboardEntry[]>([])
	let loading = $state(true)
	let sortBy = $state<'hours' | 'scraps'>('scraps')
	let user = $state<User | null>(null)
	let screws = $derived(user?.scraps ?? 0)

	async function fetchLeaderboard() {
		loading = true
		try {
			const response = await fetch(`${API_URL}/leaderboard?sortBy=${sortBy}`, {
				credentials: 'include'
			})
			if (response.ok) {
				leaderboard = await response.json()
			}
		} catch (error) {
			console.error('Failed to fetch leaderboard:', error)
		} finally {
			loading = false
		}
	}

	function setSortBy(value: 'hours' | 'scraps') {
		sortBy = value
		fetchLeaderboard()
	}

	onMount(async () => {
		user = await getUser()
		fetchLeaderboard()
	})
</script>

<svelte:head>
	<title>leaderboard | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-5xl mx-auto pb-24">
	<h1 class="text-4xl md:text-6xl font-bold mb-8">leaderboard</h1>

	<div class="flex gap-2 mb-6">
		<button
			class="px-4 py-2 border-2 border-black rounded-full font-bold transition-all duration-200 {sortBy === 'scraps'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setSortBy('scraps')}
		>
			scraps
		</button>
		<button
			class="px-4 py-2 border-2 border-black rounded-full font-bold transition-all duration-200 {sortBy === 'hours'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
			onclick={() => setSortBy('hours')}
		>
			hours
		</button>
	</div>

	<div class="border-4 border-black rounded-2xl overflow-hidden">
		{#if loading}
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
							class="border-b-2 border-black/20 last:border-b-0 hover:bg-gray-50 transition-colors"
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
								<div class="flex items-center gap-3">
									<img
										src={entry.avatar}
										alt={entry.username}
										class="w-10 h-10 rounded-full object-cover border-2 border-black"
									/>
									<span class="font-bold text-lg">{entry.username}</span>
								</div>
							</td>
							<td class="px-4 py-4 text-right text-lg">{entry.hours}h</td>
							<td class="px-4 py-4 text-right text-lg">{entry.projectCount}</td>
							<td class="px-4 py-4 text-right text-lg font-bold">{entry.scraps}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
