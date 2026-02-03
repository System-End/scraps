<script lang="ts">
	import { onMount } from 'svelte'
	import { ArrowLeft, Github, Globe, Clock, CheckCircle, AlertTriangle, Package } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'
	import { getUser } from '$lib/auth-client'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'

	let { data } = $props()

	interface Project {
		id: number
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		playableUrl: string | null
		hours: number
		status: string
		createdAt: string
	}

	interface Owner {
		id: number
		username: string | null
		avatar: string | null
	}

	let project = $state<Project | null>(null)
	let owner = $state<Owner | null>(null)
	let isOwner = $state(false)
	let loading = $state(true)
	let error = $state<string | null>(null)

	onMount(async () => {
		const user = await getUser()
		if (!user) {
			window.location.href = '/'
			return
		}

		try {
			const response = await fetch(`${API_URL}/projects/${data.id}/public`, {
				credentials: 'include'
			})

			if (!response.ok) {
				throw new Error('Project not found')
			}

			const result = await response.json()
			if (result.error) {
				throw new Error(result.error)
			}

			project = result.project
			owner = result.owner
			isOwner = result.isOwner
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load project'
		} finally {
			loading = false
		}
	})
</script>

<svelte:head>
	<title>{project?.name || 'project'} - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	{#if owner}
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
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if error}
		<div class="text-center py-12 text-gray-500">{error}</div>
	{:else if project}
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
			<div class="flex items-start justify-between mb-2">
				<h1 class="text-3xl font-bold">{project.name}</h1>
				{#if project.status === 'shipped'}
					<span class="px-3 py-1 rounded-full text-sm font-bold border-2 bg-green-100 text-green-700 border-green-600 flex items-center gap-1">
						<CheckCircle size={14} />
						shipped
					</span>
				{:else}
					<span class="px-3 py-1 rounded-full text-sm font-bold border-2 bg-yellow-100 text-yellow-700 border-yellow-600 flex items-center gap-1">
						<AlertTriangle size={14} />
						in progress
					</span>
				{/if}
			</div>
			<p class="text-gray-600 mb-4">{project.description}</p>
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<span class="px-3 py-1 bg-gray-100 rounded-full font-bold border-2 border-black flex items-center gap-1">
					<Clock size={14} />
					{formatHours(project.hours)}h
				</span>
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
						class="inline-flex items-center gap-2 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 cursor-pointer"
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

			{#if isOwner}
				<a
					href="/projects/{project.id}"
					class="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-black text-white border-4 border-black rounded-full font-bold hover:bg-gray-800 transition-all duration-200 cursor-pointer"
				>
					edit project
				</a>
			{/if}
		</div>

		<!-- Owner Info -->
		{#if owner}
			<div class="border-4 border-black rounded-2xl p-6">
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
	{/if}
</div>
