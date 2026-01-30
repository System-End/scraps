<script lang="ts">
	import { onMount } from 'svelte'
	import { Flame, ArrowRight } from '@lucide/svelte'
	import DashboardNavbar from '$lib/components/DashboardNavbar.svelte'
	import { getUser } from '$lib/auth-client'

	interface User {
		id: number
		username: string
		email: string
		avatar: string | null
		slackId: string | null
		scraps: number
	}

	let user = $state<User | null>(null)
	let screws = $derived(user?.scraps ?? 0)

	onMount(async () => {
		user = await getUser()
	})

	interface RefineRecipe {
		id: number
		name: string
		description: string
		inputItems: { name: string; count: number }[]
		outputItem: { name: string; chance: number }
		cost: number
	}

	const recipes: RefineRecipe[] = [
		{
			id: 1,
			name: 'sticker fusion',
			description: 'combine 3 common stickers for a chance at a rare one',
			inputItems: [{ name: 'common sticker', count: 3 }],
			outputItem: { name: 'rare sticker', chance: 25 },
			cost: 5
		},
		{
			id: 2,
			name: 'hardware upgrade',
			description: 'upgrade your components',
			inputItems: [
				{ name: 'resistor pack', count: 2 },
				{ name: 'breadboard', count: 1 }
			],
			outputItem: { name: 'sensor kit', chance: 40 },
			cost: 10
		},
		{
			id: 3,
			name: 'mystery box',
			description: 'trade screws for a mystery item',
			inputItems: [],
			outputItem: { name: '???', chance: 100 },
			cost: 20
		}
	]

	function refine(recipe: RefineRecipe) {
		// TODO: Call API to perform refine action
		console.log('Refining:', recipe.name)
	}
</script>

<svelte:head>
	<title>refinery | scraps</title>
</svelte:head>

<DashboardNavbar {screws} {user} />

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	<div class="flex items-center gap-4 mb-4">
		<!-- <Flame size={48} /> -->
		<h1 class="text-4xl md:text-6xl font-bold">refinery</h1>
	</div>
	<p class="text-lg text-gray-600 mb-8">upgrade and combine your scraps</p>

	<!-- Recipes -->
	<div class="space-y-6">
		{#each recipes as recipe (recipe.id)}
			<div class="border-4 border-black rounded-2xl p-6 hover:border-dashed transition-all">
				<div class="flex items-start justify-between mb-4">
					<div>
						<h3 class="font-bold text-2xl mb-1">{recipe.name}</h3>
						<p class="text-gray-600">{recipe.description}</p>
					</div>
					<button
						onclick={() => refine(recipe)}
						class="px-6 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-colors flex items-center gap-2"
					>
						<span>{recipe.cost} screws</span>
						<Flame size={16} />
					</button>
				</div>

				<div class="flex items-center gap-4 flex-wrap">
					{#if recipe.inputItems.length > 0}
						<div class="flex items-center gap-2">
							{#each recipe.inputItems as input, i}
								<span class="px-3 py-1 bg-gray-100 rounded-full text-sm font-bold">
									{input.count}x {input.name}
								</span>
								{#if i < recipe.inputItems.length - 1}
									<span class="text-gray-400">+</span>
								{/if}
							{/each}
						</div>
					{:else}
						<span class="px-3 py-1 bg-gray-100 rounded-full text-sm font-bold">screws only</span>
					{/if}

					<ArrowRight size={20} class="text-gray-400" />

					<span class="px-3 py-1 bg-black text-white rounded-full text-sm font-bold">
						{recipe.outputItem.name} ({recipe.outputItem.chance}%)
					</span>
				</div>
			</div>
		{/each}
	</div>
</div>
