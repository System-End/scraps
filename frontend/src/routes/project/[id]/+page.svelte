<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Send } from '@lucide/svelte'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface Review {
		id: number
		action: string
		feedbackForAuthor: string
		createdAt: string
	}

	interface Project {
		id: number
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		status: string
		hours: number
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
	let project = $state<Project | null>(null)
	let reviews = $state<Review[]>([])
	let loading = $state(true)
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let screws = $derived(user?.scraps ?? 0)

	let projectId = $derived(page.params.id)

	onMount(async () => {
		user = await getUser()
		if (!user) {
			goto('/')
			return
		}

		try {
			const [projectRes, reviewsRes] = await Promise.all([
				fetch(`${API_URL}/projects/${projectId}`, { credentials: 'include' }),
				fetch(`${API_URL}/projects/${projectId}/reviews`, { credentials: 'include' })
			])

			if (projectRes.ok) {
				const data = await projectRes.json()
				if (!data.error) project = data
			}

			if (reviewsRes.ok) {
				const data = await reviewsRes.json()
				if (Array.isArray(data)) reviews = data
			}
		} catch (e) {
			console.error('Failed to fetch project:', e)
		} finally {
			loading = false
		}
	})

	async function submitProject() {
		if (!project) return

		submitting = true
		error = null

		try {
			const response = await fetch(`${API_URL}/projects/${project.id}/submit`, {
				method: 'POST',
				credentials: 'include'
			})

			const data = await response.json()
			if (data.error) {
				throw new Error(data.error)
			}

			project = data
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit project'
		} finally {
			submitting = false
		}
	}

	function getStatusLabel(status: string) {
		const labels: Record<string, string> = {
			in_progress: 'in progress',
			waiting_for_review: 'waiting for review',
			shipped: 'shipped',
			permanently_rejected: 'rejected'
		}
		return labels[status] || status
	}

	function getStatusColor(status: string) {
		const colors: Record<string, string> = {
			in_progress: 'bg-gray-100',
			waiting_for_review: 'bg-yellow-100',
			shipped: 'bg-green-100',
			permanently_rejected: 'bg-red-100'
		}
		return colors[status] || 'bg-gray-100'
	}
</script>

<svelte:head>
	<title>{project?.name || 'project'} | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if !project}
		<div class="text-center py-12 text-gray-500">project not found</div>
	{:else}
		<!-- Project Image -->
		<div class="w-full h-64 md:h-96 border-4 border-black rounded-2xl overflow-hidden mb-8">
			{#if project.image}
				<img src={project.image} alt={project.name} class="w-full h-full object-cover" />
			{:else}
				<ProjectPlaceholder seed={project.id} />
			{/if}
		</div>

		<!-- Project Info -->
		<div class="mb-8">
			<div class="flex items-start justify-between mb-4">
				<h1 class="text-4xl md:text-5xl font-bold">{project.name}</h1>
				<span class="px-4 py-2 rounded-full font-bold text-sm {getStatusColor(project.status)}">
					{getStatusLabel(project.status)}
				</span>
			</div>
			<p class="text-lg text-gray-600 mb-4">{project.description}</p>
			<div class="flex items-center gap-4">
				<span class="px-3 py-1 bg-gray-100 rounded-full font-bold text-sm">{project.hours}h logged</span>
				{#if project.githubUrl}
					<a
						href={project.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="px-3 py-1 bg-gray-100 rounded-full font-bold text-sm hover:bg-gray-200 transition-colors"
					>
						github
					</a>
				{/if}
			</div>
		</div>

		{#if error}
			<div class="mb-6 p-4 bg-red-100 border-2 border-red-500 rounded-lg text-red-700">
				{error}
			</div>
		{/if}

		<!-- Submit Button -->
		{#if project.status === 'in_progress'}
			<button
				onclick={submitProject}
				disabled={submitting}
				class="w-full px-6 py-4 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 mb-8"
			>
				<Send size={20} />
				<span>{submitting ? 'submitting...' : 'submit for review'}</span>
			</button>
		{/if}

		<!-- Previous Reviews -->
		{#if reviews.length > 0}
			<div>
				<h2 class="text-2xl font-bold mb-4">review feedback</h2>
				<div class="space-y-4">
					{#each reviews as review}
						<div class="border-4 border-black rounded-2xl p-6">
							<div class="flex items-center justify-between mb-2">
								<span
									class="px-3 py-1 rounded-full font-bold text-sm {review.action === 'approved'
										? 'bg-green-100'
										: review.action === 'denied'
											? 'bg-yellow-100'
											: 'bg-red-100'}"
								>
									{review.action}
								</span>
								<span class="text-sm text-gray-500">
									{new Date(review.createdAt).toLocaleDateString()}
								</span>
							</div>
							<p class="text-gray-700">{review.feedbackForAuthor}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
