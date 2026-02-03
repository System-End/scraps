<script lang="ts">
	import { onMount } from 'svelte'
	import { ArrowLeft, Github, Clock, Package, CheckCircle, AlertTriangle, Heart, Flame, Origami } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'

	let { data } = $props()

	interface Project {
		id: number
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		hours: number
		status: string
		createdAt: string
	}

	interface HeartedItem {
		id: number
		name: string
		image: string
		price: number
	}

	interface Refinement {
		shopItemId: number
		itemName: string
		itemImage: string
		baseProbability: number
		totalBoost: number
		effectiveProbability: number
	}

	interface ProfileUser {
		id: number
		username: string
		avatar: string | null
		scraps: number
		createdAt: string
	}

	interface Stats {
		projectCount: number
		inProgressCount: number
		totalHours: number
	}

	type FilterType = 'all' | 'shipped' | 'in_progress'

	let profileUser = $state<ProfileUser | null>(null)
	let projects = $state<Project[]>([])
	let heartedItems = $state<HeartedItem[]>([])
	let refinements = $state<Refinement[]>([])
	let stats = $state<Stats | null>(null)
	let loading = $state(true)
	let error = $state<string | null>(null)
	let filter = $state<FilterType>('all')

	let filteredProjects = $derived(
		filter === 'all'
			? projects
			: filter === 'in_progress'
				? projects.filter((p) => p.status === 'in_progress' || p.status === 'waiting_for_review')
				: projects.filter((p) => p.status === filter)
	)

	onMount(async () => {
		try {
			const response = await fetch(`${API_URL}/user/profile/${data.id}`, {
				credentials: 'include'
			})
			if (response.ok) {
				const result = await response.json()
				profileUser = result.user
				projects = result.projects || []
				heartedItems = result.heartedItems || []
				refinements = result.refinements || []
				stats = result.stats
			} else {
				error = 'User not found'
			}
		} catch (e) {
			console.error('Failed to fetch profile:', e)
			error = 'Failed to load profile'
		} finally {
			loading = false
		}
	})
</script>

<svelte:head>
	<title>{profileUser?.username || 'profile'} - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	<a
		href="/leaderboard"
		class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
	>
		<ArrowLeft size={20} />
		back to leaderboard
	</a>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if error}
		<div class="text-center py-12 text-gray-500">{error}</div>
	{:else if profileUser}
		<!-- User Header -->
		<div class="border-4 border-black rounded-2xl p-6 mb-6">
			<div class="flex items-start gap-6">
				{#if profileUser.avatar}
					<img
						src={profileUser.avatar}
						alt=""
						class="w-20 h-20 rounded-full border-4 border-black"
					/>
				{:else}
					<div class="w-20 h-20 rounded-full bg-gray-200 border-4 border-black"></div>
				{/if}
				<div class="flex-1">
					<h1 class="text-3xl font-bold mb-2">{profileUser.username || 'unknown'}</h1>
					<p class="text-sm text-gray-500">
						joined {new Date(profileUser.createdAt).toLocaleDateString()}
					</p>
				</div>
				<div class="text-right">
					<p class="text-4xl font-bold">{profileUser.scraps}</p>
					<p class="text-sm text-gray-500">scraps</p>
				</div>
			</div>
		</div>

		<!-- Stats -->
		{#if stats}
			<div class="grid grid-cols-3 gap-4 mb-6">
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold text-green-600">{stats.projectCount}</p>
					<p class="text-sm text-gray-500">shipped</p>
				</div>
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold text-yellow-600">{stats.inProgressCount}</p>
					<p class="text-sm text-gray-500">in progress</p>
				</div>
				<div class="border-4 border-black rounded-2xl p-4 text-center">
					<p class="text-3xl font-bold">{stats.totalHours}h</p>
					<p class="text-sm text-gray-500">total hours</p>
				</div>
			</div>
		{/if}

		<!-- Projects -->
		<div class="border-4 border-black rounded-2xl p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<Origami size={20} />
					<h2 class="text-xl font-bold">projects ({filteredProjects.length})</h2>
				</div>
				<div class="flex gap-2">
					<button
						onclick={() => (filter = 'all')}
						class="px-4 py-2 border-4 border-black rounded-full font-bold text-sm transition-all duration-200 cursor-pointer {filter === 'all'
							? 'bg-black text-white'
							: 'hover:border-dashed'}"
					>
						all
					</button>
					<button
						onclick={() => (filter = 'shipped')}
						class="px-4 py-2 border-4 border-black rounded-full font-bold text-sm transition-all duration-200 cursor-pointer {filter === 'shipped'
							? 'bg-black text-white'
							: 'hover:border-dashed'}"
					>
						shipped
					</button>
					<button
						onclick={() => (filter = 'in_progress')}
						class="px-4 py-2 border-4 border-black rounded-full font-bold text-sm transition-all duration-200 cursor-pointer {filter === 'in_progress'
							? 'bg-black text-white'
							: 'hover:border-dashed'}"
					>
						in progress
					</button>
				</div>
			</div>
			{#if filteredProjects.length === 0}
				<p class="text-gray-500">no projects found</p>
			{:else}
				<div class="grid gap-4">
					{#each filteredProjects as project}
						<a href="/projects/{project.id}" class="block border-2 border-black rounded-lg p-4 hover:border-dashed transition-all duration-200 cursor-pointer">
							<div class="flex gap-4">
								{#if project.image}
									<img
										src={project.image}
										alt={project.name}
										class="w-24 h-24 object-cover rounded-lg border-2 border-black shrink-0"
									/>
								{:else}
									<div class="w-24 h-24 bg-gray-100 rounded-lg border-2 border-black shrink-0 flex items-center justify-center">
										<Package size={32} class="text-gray-400" />
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<h3 class="font-bold text-lg">{project.name}</h3>
										{#if project.status === 'shipped'}
											<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-600 flex items-center gap-1">
												<CheckCircle size={12} />
												shipped
											</span>
										{:else if project.status === 'waiting_for_review'}
											<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-600 flex items-center gap-1">
												<Clock size={12} />
												under review
											</span>
										{:else}
											<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-600 flex items-center gap-1">
												<AlertTriangle size={12} />
												in progress
											</span>
										{/if}
									</div>
									<p class="text-sm text-gray-600 mb-2 line-clamp-2">{project.description}</p>
									<div class="flex items-center gap-4 text-sm text-gray-500">
										<span class="flex items-center gap-1">
											<Clock size={14} />
											{formatHours(project.hours)}h
										</span>
										{#if project.githubUrl}
											<span
												onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(project.githubUrl, '_blank'); }}
												onkeydown={(e) => e.key === 'Enter' && window.open(project.githubUrl, '_blank')}
												role="link"
												tabindex="0"
												class="flex items-center gap-1 hover:text-black transition-colors cursor-pointer"
											>
												<Github size={14} />
												github
											</span>
										{/if}
									</div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Hearted Shop Items -->
		{#if heartedItems.length > 0}
			<div class="border-4 border-black rounded-2xl p-6 mt-6">
				<div class="flex items-center gap-2 mb-4">
					<Heart size={20} class="text-red-500 fill-red-500" />
					<h2 class="text-xl font-bold">wishlist ({heartedItems.length})</h2>
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
					{#each heartedItems as item}
						<a href="/shop" class="border-4 border-black rounded-2xl p-3 hover:border-dashed transition-all duration-200 cursor-pointer">
							<img src={item.image} alt={item.name} class="w-full h-20 object-contain mb-2" />
							<h3 class="font-bold text-sm truncate">{item.name}</h3>
							<p class="text-xs text-gray-500">{item.price} scraps</p>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Refinements -->
		<div class="border-4 border-black rounded-2xl p-6 mt-6">
			<div class="flex items-center gap-2 mb-4">
				<Flame size={20} class="text-orange-500" />
				<h2 class="text-xl font-bold">refinements</h2>
			</div>
			{#if refinements.length === 0}
				<p class="text-gray-500 text-center py-4">no refinements to show</p>
			{:else}
				<div class="space-y-3">
					{#each refinements.sort((a, b) => b.totalBoost - a.totalBoost) as refinement}
						{@const maxBoost = Math.max(...refinements.map(r => r.totalBoost))}
						{@const barWidth = maxBoost > 0 ? (refinement.totalBoost / maxBoost) * 100 : 0}
						<div class="relative">
							<div
								class="h-10 rounded-lg flex items-center justify-between px-3 text-white font-bold text-sm bg-black border-2 border-black"
								style="width: {Math.max(barWidth, 20)}%;"
							>
								<span class="truncate">{refinement.itemName}</span>
								<span class="shrink-0 ml-2">+{refinement.totalBoost}%</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
