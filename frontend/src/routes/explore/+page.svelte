<script lang="ts">
	import { onMount } from 'svelte'
	import { Search, Eye, X } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'

	interface ExploreProject {
		id: number
		name: string
		description: string
		image: string | null
		hours: number
		tier: number
		status: string
		views: number
		username: string | null
	}

	interface Pagination {
		page: number
		limit: number
		total: number
		totalPages: number
	}

	let projects = $state<ExploreProject[]>([])
	let pagination = $state<Pagination | null>(null)
	let loading = $state(true)
	let error = $state<string | null>(null)

	let searchQuery = $state('')
	let selectedTier = $state<number | null>(null)
	let selectedStatus = $state<string | null>(null)
	let currentPage = $state(1)

	let searchTimeout: ReturnType<typeof setTimeout>

	const TIERS = [1, 2, 3, 4]
	const STATUSES = [
		{ value: 'shipped', label: 'shipped' },
		{ value: 'in_progress', label: 'in progress' }
	]

	async function fetchProjects() {
		loading = true
		error = null

		try {
			const params = new URLSearchParams()
			params.set('page', currentPage.toString())
			params.set('limit', '20')
			if (searchQuery.trim()) params.set('search', searchQuery.trim())
			if (selectedTier) params.set('tier', selectedTier.toString())
			if (selectedStatus) params.set('status', selectedStatus)

			const response = await fetch(`${API_URL}/projects/explore?${params}`, {
				credentials: 'include'
			})

			if (!response.ok) throw new Error('Failed to fetch projects')

			const data = await response.json()
			projects = data.data
			pagination = data.pagination
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load projects'
		} finally {
			loading = false
		}
	}

	onMount(() => {
		fetchProjects()
	})

	function handleSearch() {
		clearTimeout(searchTimeout)
		searchTimeout = setTimeout(() => {
			currentPage = 1
			fetchProjects()
		}, 300)
	}

	function toggleTier(tier: number) {
		selectedTier = selectedTier === tier ? null : tier
		currentPage = 1
		fetchProjects()
	}

	function toggleStatus(status: string) {
		selectedStatus = selectedStatus === status ? null : status
		currentPage = 1
		fetchProjects()
	}

	function goToPage(page: number) {
		currentPage = page
		fetchProjects()
	}
</script>

<svelte:head>
	<title>explore - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-8">explore</h1>

	<!-- Search & Filters -->
	<div class="mb-8 space-y-4">
		<!-- Search -->
		<div class="relative">
			<Search size={20} class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
			<input
				type="text"
				bind:value={searchQuery}
				oninput={handleSearch}
				placeholder="search projects..."
				class="w-full pl-12 pr-4 py-3 border-4 border-black rounded-full focus:outline-none focus:border-dashed"
			/>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-2 items-center">
			<!-- Tier filters -->
			<span class="text-sm font-bold self-center mr-2">tier:</span>
			{#each TIERS as tier}
				<button
					onclick={() => toggleTier(tier)}
					class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {selectedTier === tier ? 'bg-black text-white' : 'hover:border-dashed'}"
				>
					{tier}
				</button>
			{/each}

			<span class="mx-4 border-l-2 border-gray-300 h-8"></span>

			<!-- Status filters -->
			<span class="text-sm font-bold self-center mr-2">status:</span>
			{#each STATUSES as status}
				<button
					onclick={() => toggleStatus(status.value)}
					class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {selectedStatus === status.value ? 'bg-black text-white' : 'hover:border-dashed'}"
				>
					{status.label}
				</button>
			{/each}
			{#if selectedTier || selectedStatus}
				<button
					onclick={() => { selectedTier = null; selectedStatus = null; currentPage = 1; fetchProjects(); }}
					class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer hover:border-dashed flex items-center gap-2"
				>
					<X size={16} />
					clear
				</button>
			{/if}
		</div>
	</div>

	<!-- Results -->
	{#if loading}
		<div class="text-center py-12 text-gray-500">loading projects...</div>
	{:else if error}
		<div class="text-center py-12 text-red-600">{error}</div>
	{:else if projects.length === 0}
		<div class="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center">
			<p class="text-gray-500 text-lg">no projects found</p>
			<p class="text-gray-400 text-sm mt-2">try adjusting your filters or search query</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each projects as project}
				<a
					href="/projects/{project.id}"
					class="border-4 border-black rounded-2xl overflow-hidden hover:border-dashed transition-all duration-200 cursor-pointer flex flex-col bg-white"
				>
					<div class="h-40 overflow-hidden">
						{#if project.image}
							<img
								src={project.image}
								alt={project.name}
								class="w-full h-full object-cover"
							/>
						{:else}
							<ProjectPlaceholder seed={project.id} />
						{/if}
					</div>
					<div class="p-4 flex-1 flex flex-col">
						<div class="flex items-start justify-between gap-2 mb-2">
							<h3 class="font-bold text-lg truncate">{project.name}</h3>
							<span class="text-xs px-2 py-0.5 rounded-full shrink-0 {project.status === 'shipped' ? 'bg-green-100' : 'bg-gray-100'}">
								{project.status.replace(/_/g, ' ')}
							</span>
						</div>
						<p class="text-sm text-gray-600 flex-1 line-clamp-2">{project.description}</p>
						<div class="mt-3 flex items-center justify-between text-sm">
							<span class="text-gray-500">by {project.username || 'anonymous'}</span>
							<div class="flex items-center gap-3">
								<span class="text-gray-500">{formatHours(project.hours)}h</span>
								<span class="px-2 py-0.5 bg-gray-100 rounded-full text-xs">tier {project.tier}</span>
								<span class="flex items-center gap-1 text-gray-400">
									<Eye size={14} />
									{project.views}
								</span>
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>

		<!-- Pagination -->
		{#if pagination && pagination.totalPages > 1}
			<div class="mt-8 flex justify-center gap-2">
				<button
					onclick={() => goToPage(currentPage - 1)}
					disabled={currentPage === 1}
					class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer hover:border-dashed disabled:opacity-50 disabled:cursor-not-allowed"
				>
					prev
				</button>
				<span class="px-4 py-2 font-bold self-center">
					{currentPage} / {pagination.totalPages}
				</span>
				<button
					onclick={() => goToPage(currentPage + 1)}
					disabled={currentPage === pagination.totalPages}
					class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer hover:border-dashed disabled:opacity-50 disabled:cursor-not-allowed"
				>
					next
				</button>
			</div>
		{/if}
	{/if}
</div>
