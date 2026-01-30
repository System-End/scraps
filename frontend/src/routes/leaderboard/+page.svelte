<script lang="ts">
	import { onMount } from 'svelte'
	import DashboardNavbar from '$lib/components/DashboardNavbar.svelte'

	interface ScrapItem {
		id: number
		name: string
		image: string
	}

	interface LeaderboardEntry {
		rank: number
		name: string
		avatar: string
		hours: number
		projects: number
		scraps: ScrapItem[]
	}

	let leaderboard = $state<LeaderboardEntry[]>([])
	let screws = $state(42)

	const dummyLeaderboard: LeaderboardEntry[] = [
		{
			rank: 1,
			name: 'zrl',
			avatar: 'https://avatars.githubusercontent.com/u/1234567?v=4',
			hours: 156,
			projects: 12,
			scraps: [
				{ id: 1, name: 'esp32', image: '/hero.png' },
				{ id: 2, name: 'rare sticker', image: '/hero.png' },
				{ id: 3, name: 'fudge', image: '/hero.png' }
			]
		},
		{
			rank: 2,
			name: 'msw',
			avatar: 'https://avatars.githubusercontent.com/u/2345678?v=4',
			hours: 142,
			projects: 8,
			scraps: [
				{ id: 4, name: 'arduino', image: '/hero.png' },
				{ id: 5, name: 'postcard', image: '/hero.png' }
			]
		},
		{
			rank: 3,
			name: 'belle',
			avatar: 'https://avatars.githubusercontent.com/u/3456789?v=4',
			hours: 128,
			projects: 15,
			scraps: [
				{ id: 6, name: 'sensor kit', image: '/hero.png' },
				{ id: 7, name: 'breadboard', image: '/hero.png' },
				{ id: 8, name: 'sticker', image: '/hero.png' },
				{ id: 9, name: 'fudge', image: '/hero.png' }
			]
		},
		{
			rank: 4,
			name: 'sam',
			avatar: 'https://avatars.githubusercontent.com/u/4567890?v=4',
			hours: 98,
			projects: 6,
			scraps: [{ id: 10, name: 'resistors', image: '/hero.png' }]
		},
		{
			rank: 5,
			name: 'max',
			avatar: 'https://avatars.githubusercontent.com/u/5678901?v=4',
			hours: 87,
			projects: 9,
			scraps: []
		},
		{
			rank: 6,
			name: 'orpheus',
			avatar: 'https://avatars.githubusercontent.com/u/6789012?v=4',
			hours: 76,
			projects: 4,
			scraps: [
				{ id: 11, name: 'esp32', image: '/hero.png' },
				{ id: 12, name: 'postcard', image: '/hero.png' }
			]
		},
		{
			rank: 7,
			name: 'heidi',
			avatar: 'https://avatars.githubusercontent.com/u/7890123?v=4',
			hours: 65,
			projects: 7,
			scraps: [{ id: 13, name: 'sticker', image: '/hero.png' }]
		},
		{
			rank: 8,
			name: 'leo',
			avatar: 'https://avatars.githubusercontent.com/u/8901234?v=4',
			hours: 54,
			projects: 3,
			scraps: []
		},
		{
			rank: 9,
			name: 'claire',
			avatar: 'https://avatars.githubusercontent.com/u/9012345?v=4',
			hours: 43,
			projects: 5,
			scraps: [{ id: 14, name: 'fudge', image: '/hero.png' }]
		},
		{
			rank: 10,
			name: 'thomas',
			avatar: 'https://avatars.githubusercontent.com/u/1234560?v=4',
			hours: 32,
			projects: 2,
			scraps: []
		}
	]

	onMount(async () => {
		// TODO: Replace with actual API call to /api/leaderboard
		// const response = await fetch('/api/leaderboard')
		// leaderboard = await response.json()
		leaderboard = dummyLeaderboard
	})
</script>

<svelte:head>
	<title>leaderboard | scraps</title>
</svelte:head>

<DashboardNavbar {screws} />

<div class="pt-24 px-6 md:px-12 max-w-5xl mx-auto pb-24">
	<h1 class="text-4xl md:text-6xl font-bold mb-8">leaderboard</h1>

	<div class="border-4 border-black rounded-2xl overflow-hidden">
		<table class="w-full">
			<thead>
				<tr class="border-b-4 border-black bg-black text-white">
					<th class="px-4 py-4 text-left font-bold">rank</th>
					<th class="px-4 py-4 text-left font-bold">user</th>
					<th class="px-4 py-4 text-right font-bold">hours</th>
					<th class="px-4 py-4 text-right font-bold">projects</th>
					<th class="px-4 py-4 text-left font-bold">scraps</th>
				</tr>
			</thead>
			<tbody>
				{#each leaderboard as entry (entry.rank)}
					<tr class="border-b-2 border-black/20 last:border-b-0 hover:bg-gray-50 transition-colors">
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
									alt={entry.name}
									class="w-10 h-10 rounded-full object-cover border-2 border-black"
								/>
								<span class="font-bold text-lg">{entry.name}</span>
							</div>
						</td>
						<td class="px-4 py-4 text-right text-lg">{entry.hours}h</td>
						<td class="px-4 py-4 text-right text-lg">{entry.projects}</td>
						<td class="px-4 py-4">
							{#if entry.scraps.length > 0}
								<div class="flex items-center -space-x-2">
									{#each entry.scraps.slice(0, 4) as scrap, i}
										<div
											class="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center overflow-hidden"
											style="z-index: {4 - i}"
											title={scrap.name}
										>
											<img src={scrap.image} alt={scrap.name} class="w-6 h-6 object-contain" />
										</div>
									{/each}
									{#if entry.scraps.length > 4}
										<div
											class="w-8 h-8 rounded-full bg-black text-white border-2 border-white flex items-center justify-center text-xs font-bold"
											style="z-index: 0"
										>
											+{entry.scraps.length - 4}
										</div>
									{/if}
								</div>
							{:else}
								<span class="text-gray-400 text-sm">none yet</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
