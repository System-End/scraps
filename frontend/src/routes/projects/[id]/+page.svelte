<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ArrowLeft, Pencil, Send, Clock, CheckCircle, XCircle, AlertCircle, Github, AlertTriangle, PlaneTakeoff, Plus } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'

	let { data } = $props()

	interface Project {
		id: number
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		hackatimeProject?: string | null
		hours: number
		hoursOverride?: number | null
		status: string
		createdAt: string
		updatedAt: string
	}

	interface Owner {
		id: number
		username: string | null
		avatar: string | null
	}

	interface ActivityEntry {
		type: 'review' | 'created' | 'submitted'
		action?: string
		feedbackForAuthor?: string | null
		createdAt: string
		reviewer?: {
			id: number
			username: string | null
			avatar: string | null
		} | null
	}

	let project = $state<Project | null>(null)
	let owner = $state<Owner | null>(null)
	let isOwner = $state(false)
	let activity = $state<ActivityEntry[]>([])
	let loading = $state(true)
	let error = $state<string | null>(null)

	onMount(async () => {
		const user = await getUser()
		if (!user) {
			goto('/')
			return
		}

		try {
			const projectRes = await fetch(`${API_URL}/projects/${data.id}`, { credentials: 'include' })

			if (!projectRes.ok) {
				throw new Error('Project not found')
			}

			const result = await projectRes.json()
			if (result.error) {
				throw new Error(result.error)
			}

			project = result.project
			owner = result.owner
			isOwner = result.isOwner
			activity = result.activity || []
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load project'
		} finally {
			loading = false
		}
	})

	function getReviewIcon(action: string) {
		switch (action) {
			case 'approved':
				return CheckCircle
			case 'denied':
				return AlertCircle
			case 'permanently_rejected':
				return XCircle
			default:
				return Clock
		}
	}

	function getReviewColor(action: string) {
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

	function getReviewLabel(action: string) {
		switch (action) {
			case 'approved':
				return 'approved'
			case 'denied':
				return 'changes requested'
			case 'permanently_rejected':
				return 'permanently rejected'
			default:
				return action
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}
</script>

<svelte:head>
	<title>{project?.name || 'project'} | scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	{#if isOwner}
		<a
			href="/dashboard"
			class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
		>
			<ArrowLeft size={20} />
			back to dashboard
		</a>
	{:else if owner}
		<a
			href="/users/{owner.id}"
			class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
		>
			<ArrowLeft size={20} />
			back to {owner.username}'s profile
		</a>
	{:else}
		<a
			href="/leaderboard"
			class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
		>
			<ArrowLeft size={20} />
			back
		</a>
	{/if}

	{#if loading}
		<div class="text-center py-12">
			<p class="text-lg text-gray-500">loading project...</p>
		</div>
	{:else if error && !project}
		<div class="text-center py-12">
			<p class="text-lg text-red-600">{error}</p>
			<a href="/dashboard" class="mt-4 inline-block font-bold underline">go back</a>
		</div>
	{:else if project}
		<!-- Project Header -->
		<div class="border-4 border-black rounded-2xl overflow-hidden bg-white mb-8">
			<!-- Image -->
			<div class="h-64 w-full overflow-hidden border-b-4 border-black">
				{#if project.image}
					<img src={project.image} alt={project.name} class="w-full h-full object-cover" />
				{:else}
					<ProjectPlaceholder seed={project.id} />
				{/if}
			</div>

			<!-- Content -->
			<div class="p-6">
				<div class="flex items-start justify-between gap-4 mb-4">
					<h1 class="text-3xl md:text-4xl font-bold">{project.name}</h1>
					{#if project.status === 'shipped'}
						<span class="px-3 py-1 rounded-full text-sm font-bold border-2 bg-green-100 text-green-700 border-green-600 flex items-center gap-1 shrink-0">
							<CheckCircle size={14} />
							shipped
						</span>
					{:else if project.status === 'waiting_for_review'}
						<span class="px-3 py-1 rounded-full text-sm font-bold border-2 bg-yellow-100 text-yellow-700 border-yellow-600 flex items-center gap-1 shrink-0">
							<Clock size={14} />
							awaiting review
						</span>
					{:else}
						<span class="px-3 py-1 rounded-full text-sm font-bold border-2 bg-yellow-100 text-yellow-700 border-yellow-600 flex items-center gap-1 shrink-0">
							<AlertTriangle size={14} />
							in progress
						</span>
					{/if}
				</div>

				{#if project.description}
					<p class="text-lg text-gray-700 mb-4">{project.description}</p>
				{:else}
					<p class="text-lg text-gray-400 italic mb-4">no description yet</p>
				{/if}

				<div class="flex flex-wrap items-center gap-3">
					<span class="px-4 py-2 bg-white rounded-full font-bold border-4 border-black flex items-center gap-2">
						<Clock size={18} />
						{formatHours(project.hours)}h
					</span>
					{#if project.githubUrl}
						<a
							href={project.githubUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 cursor-pointer flex items-center gap-2"
						>
							<Github size={18} />
							view on github
						</a>
					{/if}
				</div>
			</div>
		</div>

		<!-- Owner Info (for non-owners) -->
		{#if !isOwner && owner}
			<div class="border-4 border-black rounded-2xl p-6 mb-8">
				<h2 class="text-xl font-bold mb-4">created by</h2>
				<a
					href="/users/{owner.id}"
					class="flex items-center gap-4 hover:opacity-80 transition-all duration-200 cursor-pointer"
				>
					{#if owner.avatar}
						<img src={owner.avatar} alt="" class="w-12 h-12 rounded-full border-2 border-black" />
					{:else}
						<div class="w-12 h-12 rounded-full bg-gray-200 border-2 border-black"></div>
					{/if}
					<span class="font-bold text-lg">{owner.username || 'unknown'}</span>
				</a>
			</div>
		{/if}

		<!-- Action Buttons (only for owner) -->
		{#if isOwner}
			<div class="flex gap-4 mb-8">
				{#if project.status === 'waiting_for_review'}
					<span class="flex-1 px-6 py-3 bg-gray-200 text-gray-600 border-4 border-black rounded-full font-bold text-center flex items-center justify-center gap-2">
						<Pencil size={18} />
						edit project
					</span>
				{:else}
					<a
						href="/projects/{project.id}/edit"
						class="flex-1 px-6 py-3 border-4 border-black rounded-full font-bold text-center hover:border-dashed transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
					>
						<Pencil size={18} />
						edit project
					</a>
				{/if}
				{#if project.status === 'waiting_for_review'}
					<span class="flex-1 px-6 py-3 bg-gray-200 text-gray-600 border-4 border-black rounded-full font-bold text-center flex items-center justify-center gap-2">
						<Send size={18} />
						awaiting review
					</span>
				{:else if project.status === 'shipped'}
					<span class="flex-1 px-6 py-3 bg-gray-200 text-gray-600 border-4 border-black rounded-full font-bold text-center flex items-center justify-center gap-2">
						<Send size={18} />
						shipped
					</span>
				{:else}
					<a
						href="/projects/{project.id}/submit"
						class="flex-1 px-6 py-3 bg-black text-white border-4 border-black rounded-full font-bold hover:bg-gray-800 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
					>
						<Send size={18} />
						review & submit
					</a>
				{/if}
			</div>

			{#if error}
				<div class="mb-8 p-4 bg-red-100 border-2 border-red-500 rounded-lg text-red-700">
					{error}
				</div>
			{/if}

			<!-- Activity Timeline (only for owner) -->
			<div>
				<h2 class="text-2xl font-bold mb-6">activity</h2>

				{#if activity.length === 0}
					<div class="border-4 border-dashed border-gray-300 rounded-2xl p-8 text-center">
						<p class="text-gray-500">no activity yet</p>
						<p class="text-gray-400 text-sm mt-2">submit your project to get started</p>
					</div>
				{:else}
					<div class="relative">
						<!-- Timeline line -->
						<div class="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
						<div class="space-y-4">
							{#each activity as entry, i}
								{#if entry.type === 'review' && entry.action}
									{@const ReviewIcon = getReviewIcon(entry.action)}
									<div class="relative">
										<div class="border-4 border-black rounded-2xl p-6 bg-white hover:border-dashed transition-all duration-200 ml-8">
											<div class="absolute left-0 top-6 w-6 h-6 bg-white rounded-full flex items-center justify-center z-10">
												<ReviewIcon size={20} class={getReviewColor(entry.action)} />
											</div>
											<div>
												<div class="flex items-center justify-between mb-2">
													<span class="font-bold">{getReviewLabel(entry.action)}</span>
													<span class="text-sm text-gray-500">{formatDate(entry.createdAt)}</span>
												</div>
												{#if entry.feedbackForAuthor}
													<p class="text-gray-700 mb-3">{entry.feedbackForAuthor}</p>
												{/if}
												{#if entry.reviewer}
													<a href="/users/{entry.reviewer.id}" class="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-all duration-200 cursor-pointer">
														{#if entry.reviewer.avatar}
															<img src={entry.reviewer.avatar} alt="" class="w-6 h-6 rounded-full border-2 border-black" />
														{:else}
															<div class="w-6 h-6 rounded-full bg-gray-200 border-2 border-black"></div>
														{/if}
														<span>reviewed by <strong>{entry.reviewer.username || 'reviewer'}</strong></span>
													</a>
												{/if}
											</div>
										</div>
									</div>
								{:else if entry.type === 'submitted'}
									<div class="relative flex items-center gap-3 ml-8 py-2">
										<div class="absolute left-[-26px] w-6 h-6 bg-white rounded-full flex items-center justify-center z-10">
											<PlaneTakeoff size={16} class="text-gray-500" />
										</div>
										<span class="text-sm text-gray-500">submitted for review · {formatDate(entry.createdAt)}</span>
									</div>
								{:else if entry.type === 'created'}
									<div class="relative flex items-center gap-3 ml-8 py-2">
										<div class="absolute left-[-26px] w-6 h-6 bg-white rounded-full flex items-center justify-center z-10">
											<Plus size={16} class="text-gray-500" />
										</div>
										<span class="text-sm text-gray-500">project created · {formatDate(entry.createdAt)}</span>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>
