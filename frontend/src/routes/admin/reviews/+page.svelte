<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ChevronLeft, ChevronRight } from '@lucide/svelte'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'

	interface Project {
		id: number
		userId: number
		name: string
		description: string
		image: string | null
		status: string
		hours: number
	}

	interface Pagination {
		page: number
		limit: number
		total: number
		totalPages: number
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

	let user = $state<User | null>(null)
	let projects = $state<Project[]>([])
	let pagination = $state<Pagination | null>(null)
	let loading = $state(true)
	let scraps = $derived(user?.scraps ?? 0)

	async function fetchReviews(page = 1) {
		loading = true
		try {
			const response = await fetch(`${API_URL}/admin/reviews?page=${page}&limit=12`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				projects = data.data || []
				pagination = data.pagination
			}
		} catch (e) {
			console.error('Failed to fetch reviews:', e)
		} finally {
			loading = false
		}
	}

	onMount(async () => {
		user = await getUser()
		if (!user || (user.role !== 'admin' && user.role !== 'reviewer')) {
			goto('/dashboard')
			return
		}
		await fetchReviews()
	})

	function goToPage(page: number) {
		fetchReviews(page)
	}
</script>

<svelte:head>
	<title>reviews | admin | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-2">review queue</h1>
	<p class="text-lg text-gray-600 mb-8">projects waiting for review</p>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if projects.length === 0}
		<div class="text-center py-12">
			<p class="text-gray-500 text-xl">no projects waiting for review</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each projects as project}
				<a
					href="/admin/reviews/{project.id}"
					class="border-4 border-black rounded-2xl overflow-hidden hover:border-dashed transition-all flex flex-col"
				>
					<div class="h-40 overflow-hidden">
						{#if project.image}
							<img src={project.image} alt={project.name} class="w-full h-full object-cover" />
						{:else}
							<ProjectPlaceholder seed={project.id} />
						{/if}
					</div>
					<div class="p-4">
						<h3 class="font-bold text-xl mb-1">{project.name}</h3>
						<p class="text-gray-600 text-sm line-clamp-2 mb-2">{project.description}</p>
						<span class="px-3 py-1 bg-gray-100 rounded-full font-bold text-sm">{formatHours(project.hours)}h</span>
					</div>
				</a>
			{/each}
		</div>

		<!-- Pagination -->
		{#if pagination && pagination.totalPages > 1}
			<div class="flex items-center justify-center gap-4 mt-8">
				<button
					onclick={() => goToPage(pagination!.page - 1)}
					disabled={pagination.page <= 1}
					class="p-2 border-2 border-black rounded-full hover:border-dashed transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
				>
					<ChevronLeft size={20} />
				</button>
				<span class="font-bold">
					page {pagination.page} of {pagination.totalPages}
				</span>
				<button
					onclick={() => goToPage(pagination!.page + 1)}
					disabled={pagination.page >= pagination.totalPages}
					class="p-2 border-2 border-black rounded-full hover:border-dashed transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
				>
					<ChevronRight size={20} />
				</button>
			</div>
		{/if}
	{/if}
</div>
