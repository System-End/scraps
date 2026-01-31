<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Check, X, Ban } from '@lucide/svelte'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface Review {
		id: number
		action: string
		feedbackForAuthor: string
		internalJustification: string | null
		reviewerName: string | null
		createdAt: string
	}

	interface ProjectUser {
		id: number
		username: string | null
		email?: string
		avatar: string | null
		internalNotes: string | null
	}

	interface Project {
		id: number
		userId: number
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		hackatimeProject: string | null
		status: string
		hours: number
		hoursOverride: number | null
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
	let projectUser = $state<ProjectUser | null>(null)
	let reviews = $state<Review[]>([])
	let loading = $state(true)
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let screws = $derived(user?.scraps ?? 0)

	let feedbackForAuthor = $state('')
	let internalJustification = $state('')
	let userInternalNotes = $state('')
	let hoursOverride = $state<number | undefined>(undefined)

	let projectId = $derived(page.params.id)

	onMount(async () => {
		user = await getUser()
		if (!user || (user.role !== 'admin' && user.role !== 'reviewer')) {
			goto('/dashboard')
			return
		}

		try {
			const response = await fetch(`${API_URL}/admin/reviews/${projectId}`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				project = data.project
				projectUser = data.user
				reviews = data.reviews || []
				userInternalNotes = data.user?.internalNotes || ''
			}
		} catch (e) {
			console.error('Failed to fetch review:', e)
		} finally {
			loading = false
		}
	})

	async function submitReview(action: 'approved' | 'denied' | 'permanently_rejected') {
		if (!feedbackForAuthor.trim()) {
			error = 'Feedback for author is required'
			return
		}

		submitting = true
		error = null

		try {
			const response = await fetch(`${API_URL}/admin/reviews/${projectId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					action,
					feedbackForAuthor,
					internalJustification: internalJustification || undefined,
					hoursOverride: hoursOverride !== undefined ? hoursOverride : undefined,
					userInternalNotes: userInternalNotes || undefined
				})
			})

			const data = await response.json()
			if (data.error) {
				throw new Error(data.error)
			}

			goto('/admin/reviews')
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit review'
		} finally {
			submitting = false
		}
	}
</script>

<svelte:head>
	<title>review {project?.name || 'project'} | admin | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if !project}
		<div class="text-center py-12 text-gray-500">project not found</div>
	{:else}
		<!-- Project Image -->
		<div class="w-full h-64 md:h-80 border-4 border-black rounded-2xl overflow-hidden mb-6">
			{#if project.image}
				<img src={project.image} alt={project.name} class="w-full h-full object-cover" />
			{:else}
				<ProjectPlaceholder seed={project.id} />
			{/if}
		</div>

		<!-- Project Info -->
		<div class="border-4 border-black rounded-2xl p-6 mb-6">
			<h1 class="text-3xl font-bold mb-2">{project.name}</h1>
			<p class="text-gray-600 mb-4">{project.description}</p>
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<span class="px-3 py-1 bg-gray-100 rounded-full font-bold">{project.hours}h logged</span>
				{#if project.hackatimeProject}
					<span class="px-3 py-1 bg-gray-100 rounded-full font-bold">hackatime: {project.hackatimeProject}</span>
				{/if}
				{#if project.githubUrl}
					<a
						href={project.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="px-3 py-1 bg-gray-100 rounded-full font-bold hover:bg-gray-200"
					>
						github
					</a>
				{/if}
			</div>
		</div>

		<!-- User Info -->
		{#if projectUser}
			<div class="border-4 border-black rounded-2xl p-6 mb-6">
				<h2 class="text-xl font-bold mb-4">submitter</h2>
				<div class="flex items-center gap-4 mb-4">
					{#if projectUser.avatar}
						<img src={projectUser.avatar} alt="" class="w-12 h-12 rounded-full border-2 border-black" />
					{/if}
					<div>
						<p class="font-bold">{projectUser.username || 'unknown'}</p>
						{#if projectUser.email}
							<p class="text-sm text-gray-500">{projectUser.email}</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Previous Reviews -->
		{#if reviews.length > 0}
			<div class="border-4 border-black rounded-2xl p-6 mb-6">
				<h2 class="text-xl font-bold mb-4">previous reviews</h2>
				<div class="space-y-4">
					{#each reviews as review}
						<div class="border-2 border-gray-200 rounded-lg p-4">
							<div class="flex items-center justify-between mb-2">
								<span class="font-bold">{review.reviewerName || 'reviewer'}</span>
								<div class="flex items-center gap-2">
									<span
										class="px-2 py-1 rounded text-xs font-bold {review.action === 'approved'
											? 'bg-green-100'
											: review.action === 'denied'
												? 'bg-yellow-100'
												: 'bg-red-100'}"
									>
										{review.action}
									</span>
									<span class="text-xs text-gray-500">
										{new Date(review.createdAt).toLocaleDateString()}
									</span>
								</div>
							</div>
							<p class="text-sm text-gray-700 mb-2"><strong>Feedback:</strong> {review.feedbackForAuthor}</p>
							{#if review.internalJustification}
								<p class="text-sm text-gray-500"><strong>Internal:</strong> {review.internalJustification}</p>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if error}
			<div class="mb-6 p-4 bg-red-100 border-2 border-red-500 rounded-lg text-red-700">
				{error}
			</div>
		{/if}

		<!-- Review Form -->
		<div class="border-4 border-black rounded-2xl p-6">
			<h2 class="text-xl font-bold mb-4">submit review</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-bold mb-1">user internal notes</label>
					<textarea
						bind:value={userInternalNotes}
						rows="3"
						placeholder="Notes about this user (visible to reviewers only)"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-bold mb-1">hours override</label>
					<input
						type="number"
						step="0.1"
						bind:value={hoursOverride}
						placeholder={String(project.hours)}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label class="block text-sm font-bold mb-1">internal justification</label>
					<textarea
						bind:value={internalJustification}
						rows="2"
						placeholder="Internal notes about this review decision"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div>
					<label class="block text-sm font-bold mb-1">
						feedback for author <span class="text-red-500">*</span>
					</label>
					<textarea
						bind:value={feedbackForAuthor}
						rows="4"
						placeholder="This will be shown to the project author"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div class="flex gap-3 pt-4">
					<button
						onclick={() => submitReview('approved')}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-green-600 text-white rounded-full font-bold hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
					>
						<Check size={20} />
						<span>approve</span>
					</button>
					<button
						onclick={() => submitReview('denied')}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-full font-bold hover:bg-yellow-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
					>
						<X size={20} />
						<span>deny</span>
					</button>
					<button
						onclick={() => submitReview('permanently_rejected')}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
					>
						<Ban size={20} />
						<span>reject</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
