<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { Check, X, Ban, Github, AlertTriangle, CheckCircle, XCircle, Info, Globe } from '@lucide/svelte'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'

	interface Review {
		id: number
		action: string
		feedbackForAuthor: string
		internalJustification: string | null
		reviewerName: string | null
		reviewerAvatar: string | null
		reviewerId: number
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
		playableUrl: string | null
		hackatimeProject: string | null
		status: string
		hours: number
		hoursOverride: number | null
		deleted: number | null
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
	let savingNotes = $state(false)
	let error = $state<string | null>(null)
	let scraps = $derived(user?.scraps ?? 0)

	let feedbackForAuthor = $state('')
	let internalJustification = $state('')
	let userInternalNotes = $state('')
	let hoursOverride = $state<number | undefined>(undefined)

	let confirmAction = $state<'approved' | 'denied' | 'permanently_rejected' | null>(null)

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
				if (data.error) {
					error = data.error
					loading = false
					return
				}
				project = data.project
				projectUser = data.user
				reviews = data.reviews || []
				userInternalNotes = data.user?.internalNotes || ''

				// Check if project is deleted or not waiting for review
				if (project?.deleted) {
					error = 'This project has been deleted'
				} else if (project?.status !== 'waiting_for_review') {
					error = 'This project is not marked for review'
				}
			}
		} catch (e) {
			console.error('Failed to fetch review:', e)
		} finally {
			loading = false
		}
	})

	async function saveUserNotes() {
		if (!projectUser) return
		savingNotes = true
		try {
			await fetch(`${API_URL}/admin/users/${projectUser.id}/notes`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ internalNotes: userInternalNotes })
			})
		} catch (e) {
			console.error('Failed to save notes:', e)
		} finally {
			savingNotes = false
		}
	}

	function requestConfirmation(action: 'approved' | 'denied' | 'permanently_rejected') {
		if (!feedbackForAuthor.trim()) {
			error = 'Feedback for author is required'
			return
		}
		confirmAction = action
	}

	function cancelConfirmation() {
		confirmAction = null
	}

	async function submitReview() {
		if (!confirmAction) return
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
					action: confirmAction,
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
			confirmAction = null
		}
	}

	function getActionLabel(action: string) {
		switch (action) {
			case 'approved':
				return 'approve'
			case 'denied':
				return 'reject'
			case 'permanently_rejected':
				return 'permanently reject'
			default:
				return action
		}
	}

	function getReviewIcon(action: string) {
		switch (action) {
			case 'approved':
				return CheckCircle
			case 'denied':
				return AlertTriangle
			case 'permanently_rejected':
				return XCircle
			default:
				return Info
		}
	}

	function getReviewIconColor(action: string) {
		switch (action) {
			case 'approved':
				return 'text-green-600'
			case 'denied':
				return 'text-yellow-600'
			case 'permanently_rejected':
				return 'text-red-600'
			default:
				return 'text-gray-600'
		}
	}

	function getStatusTag(status: string) {
		switch (status) {
			case 'shipped':
				return { label: 'approved', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-600' }
			case 'in_progress':
			case 'waiting_for_review':
				return { label: 'in progress', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-600' }
			case 'permanently_rejected':
				return { label: 'permanently rejected', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-600' }
			default:
				return { label: status.replace(/_/g, ' '), bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-600' }
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
		<div class="text-center py-12">
			<p class="text-gray-500 text-xl mb-4">project not found</p>
			<a href="/admin/reviews" class="font-bold underline">back to reviews</a>
		</div>
	{:else if project.deleted || project.status !== 'waiting_for_review'}
		<div class="text-center py-12">
			<p class="text-gray-500 text-xl mb-2">
				{project.deleted ? 'this project has been deleted' : 'this project is not marked for review'}
			</p>
			<p class="text-gray-400 mb-4">status: {project.status}</p>
			<a href="/projects/{project.id}" class="font-bold underline">view project</a>
		</div>
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
		{@const statusTag = getStatusTag(project.status)}
		<div class="border-4 border-black rounded-2xl p-6 mb-6">
			<div class="flex items-start justify-between mb-2">
				<h1 class="text-3xl font-bold">{project.name}</h1>
				<span class="px-3 py-1 rounded-full text-sm font-bold border-2 {statusTag.bg} {statusTag.text} {statusTag.border}">
					{statusTag.label}
				</span>
			</div>
			<p class="text-gray-600 mb-4">{project.description}</p>
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<span class="px-3 py-1 bg-gray-100 rounded-full font-bold border-2 border-black">{formatHours(project.hours)}h logged</span>
				{#if project.hackatimeProject}
					<span class="px-3 py-1 bg-gray-100 rounded-full font-bold border-2 border-black">hackatime: {project.hackatimeProject}</span>
				{/if}
			</div>

			<div class="flex flex-wrap gap-3 mt-4">
				{#if project.githubUrl}
					<a
						href={project.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 cursor-pointer"
					>
						<Github size={18} />
						<span>view on github</span>
					</a>
				{:else}
					<span class="inline-flex items-center gap-2 px-4 py-2 border-4 border-dashed border-gray-300 text-gray-400 rounded-full font-bold cursor-not-allowed">
						<Github size={18} />
						<span>view on github</span>
					</span>
				{/if}
				{#if project.playableUrl}
					<a
						href={project.playableUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 px-4 py-2 border-4 border-dashed border-black rounded-full font-bold hover:border-solid transition-all duration-200 cursor-pointer"
					>
						<Globe size={18} />
						<span>try it out</span>
					</a>
				{:else}
					<span class="inline-flex items-center gap-2 px-4 py-2 border-4 border-dashed border-gray-300 text-gray-400 rounded-full font-bold cursor-not-allowed">
						<Globe size={18} />
						<span>try it out</span>
					</span>
				{/if}
			</div>

			<!-- User Info (clickable) -->
			{#if projectUser}
				<a
					href="/admin/users/{projectUser.id}"
					class="flex items-center gap-4 mt-6 pt-6 border-t-2 border-gray-200 hover:bg-gray-50 -mx-6 -mb-6 px-6 pb-6 transition-all cursor-pointer"
				>
					{#if projectUser.avatar}
						<img src={projectUser.avatar} alt="" class="w-12 h-12 rounded-full border-2 border-black" />
					{:else}
						<div class="w-12 h-12 rounded-full bg-gray-200 border-2 border-black"></div>
					{/if}
					<div class="flex-1">
						<p class="font-bold">{projectUser.username || 'unknown'}</p>
						{#if projectUser.email}
							<p class="text-sm text-gray-500">{projectUser.email}</p>
						{/if}
					</div>
					<span class="text-sm text-gray-500">view profile →</span>
				</a>
			{/if}
		</div>

		<!-- User Internal Notes Section -->
		{#if projectUser}
			<div class="border-4 border-black rounded-2xl p-6 mb-6 bg-white">
				<h2 class="text-xl font-bold mb-4">user internal notes</h2>
				<textarea
					bind:value={userInternalNotes}
					rows="3"
					placeholder="Notes about this user (visible to reviewers only)"
					class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none bg-white"
				></textarea>
				<div class="flex items-center justify-between mt-3">
					<p class="text-xs text-gray-500">these notes persist across all reviews for this user</p>
					<button
						onclick={saveUserNotes}
						disabled={savingNotes}
						class="px-4 py-2 bg-black text-white rounded-full font-bold text-sm hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
					>
						{savingNotes ? 'saving...' : 'save notes'}
					</button>
				</div>
			</div>
		{/if}

		<!-- Previous Reviews -->
		{#if reviews.length > 0}
			<div class="border-4 border-black rounded-2xl p-6 mb-6">
				<h2 class="text-xl font-bold mb-4">previous reviews</h2>
				<div class="space-y-4">
					{#each reviews as review}
						{@const ReviewIcon = getReviewIcon(review.action)}
						<div class="border-2 border-black rounded-lg p-4 hover:border-dashed transition-all duration-200">
							<div class="flex items-center justify-between mb-2">
								<a href="/admin/users/{review.reviewerId}" class="flex items-center gap-2 hover:opacity-80 transition-all duration-200 cursor-pointer">
									{#if review.reviewerAvatar}
										<img src={review.reviewerAvatar} alt="" class="w-6 h-6 rounded-full border-2 border-black" />
									{:else}
										<div class="w-6 h-6 rounded-full bg-gray-200 border-2 border-black"></div>
									{/if}
									<ReviewIcon size={18} class={getReviewIconColor(review.action)} />
									<span class="font-bold">{review.reviewerName || 'reviewer'}</span>
								</a>
								<div class="flex items-center gap-2">
									<span
										class="px-2 py-1 rounded text-xs font-bold border {review.action === 'approved'
											? 'bg-green-100 text-green-700 border-green-600'
											: review.action === 'denied'
												? 'bg-yellow-100 text-yellow-700 border-yellow-600'
												: 'bg-red-100 text-red-700 border-red-600'}"
									>
										{review.action === 'permanently_rejected' ? 'rejected' : review.action}
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
						onclick={() => requestConfirmation('approved')}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-green-600 text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
					>
						<Check size={20} />
						<span>approve</span>
					</button>
					<button
						onclick={() => requestConfirmation('denied')}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-yellow-500 text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
					>
						<X size={20} />
						<span>reject</span>
					</button>
					<button
						onclick={() => requestConfirmation('permanently_rejected')}
						disabled={submitting}
						class="flex-1 px-4 py-3 bg-red-600 text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
					>
						<Ban size={20} />
						<span>permanently reject</span>
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Confirmation Modal -->
{#if confirmAction}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={(e) => e.target === e.currentTarget && cancelConfirmation()}
		onkeydown={(e) => e.key === 'Escape' && cancelConfirmation()}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
			<h2 class="text-2xl font-bold mb-4">confirm {getActionLabel(confirmAction)}</h2>
			<p class="text-gray-600 mb-6">
				are you sure you want to <strong>{getActionLabel(confirmAction)}</strong> this project?
				{#if confirmAction === 'permanently_rejected'}
					<span class="text-red-600 block mt-2">this action cannot be undone.</span>
				{/if}
			</p>
			<div class="flex gap-3">
				<button
					onclick={cancelConfirmation}
					disabled={submitting}
					class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
				>
					cancel
				</button>
				<button
					onclick={submitReview}
					disabled={submitting}
					class="flex-1 px-4 py-2 rounded-full font-bold border-4 border-black transition-all duration-200 disabled:opacity-50 cursor-pointer hover:border-dashed {confirmAction === 'approved'
						? 'bg-green-600 text-white'
						: confirmAction === 'denied'
							? 'bg-yellow-500 text-white'
							: 'bg-red-600 text-white'}"
				>
					{submitting ? 'submitting...' : getActionLabel(confirmAction)}
				</button>
			</div>
		</div>
	</div>
{/if}
