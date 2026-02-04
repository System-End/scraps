<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ArrowLeft, Send, Check, ChevronDown } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'

	let { data } = $props()

	interface Project {
		id: number
		userId: string
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		playableUrl: string | null
		hackatimeProject: string | null
		hours: number
		status: string
		tier: number
	}

	const TIERS = [
		{ value: 1, description: 'simple projects, tutorials, small scripts' },
		{ value: 2, description: 'moderate complexity, multi-file projects' },
		{ value: 3, description: 'complex features, APIs, integrations' },
		{ value: 4, description: 'full applications, major undertakings' }
	]

	interface HackatimeProject {
		name: string
		hours: number
		repoUrl: string | null
		languages: string[]
	}

	let project = $state<Project | null>(null)
	let loading = $state(true)
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let hackatimeProjects = $state<HackatimeProject[]>([])
	let userSlackId = $state<string | null>(null)
	let selectedHackatimeName = $state<string | null>(null)
	let loadingProjects = $state(false)
	let showDropdown = $state(false)
	let selectedTier = $state(1)

	const NAME_MAX = 50
	const DESC_MIN = 20
	const DESC_MAX = 1000

	let hasImage = $derived(!!project?.image)
	let hasHackatime = $derived(!!selectedHackatimeName)
	let hasGithub = $derived(!!project?.githubUrl?.trim())
	let hasPlayableUrl = $derived(!!project?.playableUrl?.trim())
	let hasDescription = $derived((project?.description?.trim().length ?? 0) >= DESC_MIN && (project?.description?.trim().length ?? 0) <= DESC_MAX)
	let hasName = $derived((project?.name?.trim().length ?? 0) > 0 && (project?.name?.trim().length ?? 0) <= NAME_MAX)
	let allRequirementsMet = $derived(hasImage && hasHackatime && hasGithub && hasPlayableUrl && hasDescription && hasName)

	onMount(async () => {
		const user = await getUser()
		if (!user) {
			goto('/')
			return
		}

		try {
			const response = await fetch(`${API_URL}/projects/${data.id}`, {
				credentials: 'include'
			})
			if (!response.ok) {
				throw new Error('Project not found')
			}
			const responseData = await response.json()
			if (responseData.error) {
				throw new Error(responseData.error)
			}
			if (!responseData.isOwner) {
				throw new Error('You can only submit your own projects')
			}
			project = responseData.project
			if (project?.hackatimeProject) {
				const parts = project.hackatimeProject.split('/')
				selectedHackatimeName = parts.length > 1 ? parts.slice(1).join('/') : parts[0]
			}
			selectedTier = project?.tier ?? 1
			fetchHackatimeProjects()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load project'
		} finally {
			loading = false
		}
	})

	async function fetchHackatimeProjects() {
		loadingProjects = true
		try {
			const response = await fetch(`${API_URL}/hackatime/projects`, {
				credentials: 'include'
			})
			if (response.ok) {
				const apiData = await response.json()
				hackatimeProjects = apiData.projects || []
				userSlackId = apiData.slackId || null
			}
		} catch (e) {
			console.error('Failed to fetch hackatime projects:', e)
		} finally {
			loadingProjects = false
		}
	}

	function selectHackatimeProject(hp: HackatimeProject) {
		if (project) {
			selectedHackatimeName = hp.name
			project.hours = hp.hours
			if (hp.repoUrl && !project.githubUrl) {
				project.githubUrl = hp.repoUrl
			}
		}
		showDropdown = false
	}

	async function handleSubmit() {
		if (!project || !allRequirementsMet) return

		submitting = true
		error = null

		const hackatimeValue = selectedHackatimeName && userSlackId
			? `${userSlackId}/${selectedHackatimeName}`
			: null

		try {
			// First update the project with any changes
			const updateResponse = await fetch(`${API_URL}/projects/${project.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					name: project.name,
					description: project.description,
					image: project.image,
					githubUrl: project.githubUrl,
					playableUrl: project.playableUrl,
					hackatimeProject: hackatimeValue,
					tier: selectedTier
				})
			})

			if (!updateResponse.ok) {
				const responseData = await updateResponse.json().catch(() => ({}))
				throw new Error(responseData.message || 'Failed to update project')
			}

			// Then submit for review
			const submitResponse = await fetch(`${API_URL}/projects/${project.id}/submit`, {
				method: 'POST',
				credentials: 'include'
			})

			const submitData = await submitResponse.json().catch(() => ({}))
			
			if (submitData.error === 'ineligible' && submitData.redirectTo) {
				goto(submitData.redirectTo)
				return
			}

			if (!submitResponse.ok) {
				throw new Error(submitData.message || 'Failed to submit project')
			}

			goto(`/projects/${project.id}`)
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit project'
		} finally {
			submitting = false
		}
	}
</script>

<svelte:head>
	<title>submit {project?.name || 'project'} - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	<a
		href="/projects/{data.id}"
		class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
	>
		<ArrowLeft size={20} />
		back to project
	</a>

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
		<div class="border-4 border-black rounded-2xl p-6 bg-white">
			<h1 class="text-3xl font-bold mb-2">submit for review</h1>
			<p class="text-gray-600 mb-6">make sure your project meets all requirements before submitting</p>

			{#if error}
				<div class="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-sm">
					{error}
				</div>
			{/if}

			<!-- Project Image Preview -->
			<div class="mb-6">
				<label class="block text-sm font-bold mb-2">project image</label>
				{#if project.image}
					<img src={project.image} alt={project.name} class="w-full h-48 object-contain rounded-lg border-2 border-black bg-gray-50" />
				{:else}
					<div class="w-full h-48 bg-gray-200 rounded-lg border-2 border-black flex items-center justify-center text-gray-400">
						no image - <a href="/projects/{project.id}/edit" class="underline ml-1">add one in edit</a>
					</div>
				{/if}
			</div>

			<!-- Editable Fields -->
			<div class="space-y-4 mb-6">
				<!-- Name -->
				<div>
					<label for="name" class="block text-sm font-bold mb-2">name <span class="text-red-500">*</span></label>
					<input
						id="name"
						type="text"
						bind:value={project.name}
						maxlength={NAME_MAX}
						class="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
					<p class="text-xs text-gray-500 mt-1 text-right">{project.name.length}/{NAME_MAX}</p>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="block text-sm font-bold mb-2">description <span class="text-red-500">*</span></label>
					<textarea
						id="description"
						bind:value={project.description}
						rows="4"
						maxlength={DESC_MAX}
						class="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
					<p class="text-xs mt-1 text-right {project.description.length < DESC_MIN ? 'text-red-500' : 'text-gray-500'}">{project.description.length}/{DESC_MAX} (min {DESC_MIN})</p>
				</div>

				<!-- GitHub URL -->
				<div>
					<label for="githubUrl" class="block text-sm font-bold mb-2">github url <span class="text-red-500">*</span></label>
					<input
						id="githubUrl"
						type="url"
						bind:value={project.githubUrl}
						placeholder="https://github.com/user/repo"
						class="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<!-- Playable URL -->
				<div>
					<label for="playableUrl" class="block text-sm font-bold mb-2">playable url <span class="text-red-500">*</span></label>
					<input
						id="playableUrl"
						type="url"
						bind:value={project.playableUrl}
						placeholder="https://yourproject.com or https://replit.com/..."
						class="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
					<p class="text-xs text-gray-500 mt-1">a link where reviewers can try your project</p>
				</div>

				<!-- Hackatime Project Dropdown -->
				<div>
					<label class="block text-sm font-bold mb-2">hackatime project <span class="text-red-500">*</span></label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-dashed text-left flex items-center justify-between cursor-pointer"
						>
							{#if loadingProjects}
								<span class="text-gray-500">loading projects...</span>
							{:else if selectedHackatimeName}
								<span>{selectedHackatimeName} <span class="text-gray-500">({formatHours(project.hours)}h)</span></span>
							{:else}
								<span class="text-gray-500">select a project</span>
							{/if}
							<ChevronDown size={20} class={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
						</button>

						{#if showDropdown && !loadingProjects}
							<div class="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black rounded-lg max-h-48 overflow-y-auto z-10">
								{#if hackatimeProjects.length === 0}
									<div class="px-4 py-2 text-gray-500 text-sm">no projects found</div>
								{:else}
									{#each hackatimeProjects as hp}
										<button
											type="button"
											onclick={() => selectHackatimeProject(hp)}
											class="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center cursor-pointer"
										>
											<span class="font-medium">{hp.name}</span>
											<span class="text-gray-500 text-sm">{formatHours(hp.hours)}h</span>
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Tier Selection -->
			<div class="mb-6">
				<label class="block text-sm font-bold mb-2">project tier <span class="text-red-500">*</span></label>
				<p class="text-xs text-gray-500 mb-3">select the complexity tier that best matches your project</p>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{#each TIERS as tier}
						<button
							type="button"
							onclick={() => (selectedTier = tier.value)}
							class="px-4 py-3 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer text-left {selectedTier === tier.value ? 'bg-black text-white' : 'hover:border-dashed'}"
						>
							<div class="flex items-center justify-between">
								<span>tier {tier.value}</span>
							</div>
							<p class="text-xs mt-1 {selectedTier === tier.value ? 'text-gray-300' : 'text-gray-500'}">{tier.description}</p>
						</button>
					{/each}
				</div>
			</div>

			<!-- Requirements Checklist -->
			<div class="border-2 border-black rounded-lg p-4 mb-6">
				<p class="font-bold mb-3">requirements checklist</p>
				<ul class="space-y-2">
					<li class="flex items-center gap-2 text-sm">
						<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasImage ? 'bg-black text-white' : ''}">
							{#if hasImage}<Check size={12} />{/if}
						</span>
						<span class={hasImage ? '' : 'text-gray-500'}>project image uploaded</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasName ? 'bg-black text-white' : ''}">
							{#if hasName}<Check size={12} />{/if}
						</span>
						<span class={hasName ? '' : 'text-gray-500'}>project name (max {NAME_MAX} chars)</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasDescription ? 'bg-black text-white' : ''}">
							{#if hasDescription}<Check size={12} />{/if}
						</span>
						<span class={hasDescription ? '' : 'text-gray-500'}>description ({DESC_MIN}-{DESC_MAX} chars)</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasGithub ? 'bg-black text-white' : ''}">
							{#if hasGithub}<Check size={12} />{/if}
						</span>
						<span class={hasGithub ? '' : 'text-gray-500'}>github repository linked</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasPlayableUrl ? 'bg-black text-white' : ''}">
							{#if hasPlayableUrl}<Check size={12} />{/if}
						</span>
						<span class={hasPlayableUrl ? '' : 'text-gray-500'}>playable url provided</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasHackatime ? 'bg-black text-white' : ''}">
							{#if hasHackatime}<Check size={12} />{/if}
						</span>
						<span class={hasHackatime ? '' : 'text-gray-500'}>hackatime project selected</span>
					</li>
				</ul>
			</div>

			<!-- Actions -->
			<div class="flex gap-4">
				<a
					href="/projects/{data.id}"
					class="flex-1 px-4 py-3 border-4 border-black rounded-full font-bold text-center hover:border-dashed transition-all duration-200 cursor-pointer"
				>
					cancel
				</a>
				<button
					onclick={handleSubmit}
					disabled={submitting || !allRequirementsMet}
					class="flex-1 px-4 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
				>
					<Send size={18} />
					{submitting ? 'submitting...' : 'submit for review'}
				</button>
			</div>
		</div>
	{/if}
</div>
