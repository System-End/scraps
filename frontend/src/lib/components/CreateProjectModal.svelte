<script lang="ts">
	import { X, ChevronDown, Upload, Check } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'
	import { tutorialProjectIdStore } from '$lib/stores'
	import { goto } from '$app/navigation'

	interface Project {
		id: number
		userId: string
		name: string
		description: string
		image: string | null
		githubUrl: string | null
		hackatimeProject: string | null
		hours: number
		status: string
	}

	interface HackatimeProject {
		name: string
		hours: number
		repoUrl: string | null
		languages: string[]
	}

	let {
		open,
		onClose,
		onCreated,
		tutorialMode = false
	}: {
		open: boolean
		onClose: () => void
		onCreated: (project: Project) => void
		tutorialMode?: boolean
	} = $props()

	let name = $state('')
	let description = $state('')

	// Pre-fill values when modal opens in tutorial mode
	$effect(() => {
		if (open && tutorialMode && name === '' && description === '') {
			name = 'my first scrap'
			description = "this is my first project on scraps! i'm excited to start building and earning rewards."
		}
	})
	let githubUrl = $state('')
	let imageUrl = $state<string | null>(null)
	let imagePreview = $state<string | null>(null)
	let uploadingImage = $state(false)
	let selectedHackatimeProject = $state<HackatimeProject | null>(null)
	let hackatimeProjects = $state<HackatimeProject[]>([])
	let userSlackId = $state<string | null>(null)
	let loadingProjects = $state(false)
	let showDropdown = $state(false)
	let loading = $state(false)
	let error = $state<string | null>(null)

	const NAME_MAX = 50
	const DESC_MIN = 20
	const DESC_MAX = 1000

	let hasImage = $derived(!!imageUrl)
	let hasHackatime = $derived(!!selectedHackatimeProject)
	let hasDescription = $derived(description.trim().length >= DESC_MIN && description.trim().length <= DESC_MAX)
	let hasName = $derived(name.trim().length > 0 && name.trim().length <= NAME_MAX)
	let allRequirementsMet = $derived(hasDescription && hasName)

	async function fetchHackatimeProjects() {
		loadingProjects = true
		try {
			const response = await fetch(`${API_URL}/hackatime/projects`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				hackatimeProjects = data.projects || []
				userSlackId = data.slackId || null
			}
		} catch (e) {
			console.error('Failed to fetch hackatime projects:', e)
		} finally {
			loadingProjects = false
		}
	}

	$effect(() => {
		if (open) {
			fetchHackatimeProjects()
		}
	})

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file) return

		if (file.size > 5 * 1024 * 1024) {
			error = 'Image must be less than 5MB'
			return
		}

		imagePreview = URL.createObjectURL(file)
		uploadingImage = true
		error = null

		try {
			const formData = new FormData()
			formData.append('file', file)

			const response = await fetch(`${API_URL}/upload/image`, {
				method: 'POST',
				credentials: 'include',
				body: formData
			})

			const data = await response.json()
			if (data.error) {
				throw new Error(data.error)
			}

			imageUrl = data.url
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to upload image'
			imagePreview = null
		} finally {
			uploadingImage = false
		}
	}

	function removeImage() {
		imageUrl = null
		imagePreview = null
	}

	function selectProject(project: HackatimeProject) {
		selectedHackatimeProject = project
		showDropdown = false
		// Always update GitHub URL from hackatime project if available
		if (project.repoUrl) {
			githubUrl = project.repoUrl
		}
	}

	function resetForm() {
		name = ''
		description = ''
		githubUrl = ''
		imageUrl = null
		imagePreview = null
		selectedHackatimeProject = null
		showDropdown = false
		error = null
	}

	async function handleSubmit() {
		if (!allRequirementsMet) {
			error = 'Please complete all requirements'
			return
		}

		loading = true
		error = null

		const hackatimeValue = selectedHackatimeProject && userSlackId
			? `${userSlackId}/${selectedHackatimeProject.name}`
			: null
		const finalGithubUrl = githubUrl.trim() || selectedHackatimeProject?.repoUrl || null

		try {
			const response = await fetch(`${API_URL}/projects`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					name,
					description,
					image: imageUrl || null,
					githubUrl: finalGithubUrl,
					hackatimeProject: hackatimeValue
				})
			})

			if (!response.ok) {
				const data = await response.json().catch(() => ({}))
				throw new Error(data.message || 'Failed to create project')
			}

			const newProject = await response.json()
			resetForm()
			if (tutorialMode) {
				tutorialProjectIdStore.set(newProject.id)
				window.dispatchEvent(new CustomEvent('tutorial:project-created'))
				onCreated(newProject)
				goto(`/projects/${newProject.id}`, { invalidateAll: false })
			} else {
				onCreated(newProject)
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create project'
		} finally {
			loading = false
		}
	}

	function handleClose() {
		resetForm()
		onClose()
	}

	function handleBackdropClick(e: MouseEvent) {
		if (tutorialMode) return
		if (e.target === e.currentTarget) {
			handleClose()
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 flex items-center justify-center p-4 {tutorialMode ? 'z-[200] bg-transparent' : 'z-50 bg-black/50'}"
		onclick={handleBackdropClick}
		onkeydown={(e) => !tutorialMode && e.key === 'Escape' && handleClose()}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black max-h-[90vh] overflow-y-auto {tutorialMode ? 'z-[250]' : ''}" data-tutorial="create-project-modal">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold">new project</h2>
				{#if !tutorialMode}
					<button onclick={handleClose} class="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
						<X size={24} />
					</button>
				{/if}
			</div>

			{#if error}
				<div class="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-sm">
					{error}
				</div>
			{/if}

			<div class="space-y-4">
				<!-- Image Upload -->
				<div>
					<label class="block text-sm font-bold mb-1">image <span class="text-gray-400">(optional)</span></label>
					{#if imagePreview}
						<div class="relative w-full h-40 border-2 border-black rounded-lg overflow-hidden">
							<img src={imagePreview} alt="Preview" class="w-full h-full object-contain bg-gray-100" />
							{#if uploadingImage}
								<div class="absolute inset-0 bg-black/50 flex items-center justify-center">
									<span class="text-white font-bold">uploading...</span>
								</div>
							{:else}
								<button
									type="button"
									onclick={removeImage}
									class="absolute top-2 right-2 p-1 bg-white rounded-full border-2 border-black hover:bg-gray-100 cursor-pointer"
								>
									<X size={16} />
								</button>
							{/if}
						</div>
					{:else}
						<label class="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-black rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
							<Upload size={32} class="text-gray-400 mb-2" />
							<span class="text-sm text-gray-500">click to upload image</span>
							<input type="file" accept="image/*" onchange={handleImageUpload} class="hidden" />
						</label>
					{/if}
				</div>

				<!-- Name -->
				<div>
					<label for="name" class="block text-sm font-bold mb-1">name <span class="text-red-500">*</span></label>
					<input
						id="name"
						type="text"
						bind:value={name}
						maxlength={NAME_MAX}
						required
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
					<p class="text-xs text-gray-500 mt-1 text-right">{name.length}/{NAME_MAX}</p>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="block text-sm font-bold mb-1">description <span class="text-red-500">*</span></label>
					<textarea
						id="description"
						bind:value={description}
						rows="3"
						maxlength={DESC_MAX}
						required
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
					<p class="text-xs mt-1 text-right {description.length < DESC_MIN ? 'text-red-500' : 'text-gray-500'}">{description.length}/{DESC_MAX} (min {DESC_MIN})</p>
				</div>

				<!-- Hackatime Project Dropdown -->
				<div>
					<label class="block text-sm font-bold mb-1">hackatime project <span class="text-gray-400">(optional)</span></label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed text-left flex items-center justify-between"
						>
							{#if loadingProjects}
								<span class="text-gray-500">loading projects...</span>
							{:else if selectedHackatimeProject}
								<span>{selectedHackatimeProject.name} <span class="text-gray-500">({formatHours(selectedHackatimeProject.hours)}h)</span></span>
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
									{#each hackatimeProjects as project}
										<button
											type="button"
											onclick={() => selectProject(project)}
											class="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center cursor-pointer"
										>
											<span class="font-medium">{project.name}</span>
											<span class="text-gray-500 text-sm">{formatHours(project.hours)}h</span>
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<!-- GitHub URL (optional) -->
				<div>
					<label for="githubUrl" class="block text-sm font-bold mb-1">github url <span class="text-gray-400">(optional)</span></label>
					<input
						id="githubUrl"
						type="url"
						bind:value={githubUrl}
						placeholder="https://github.com/user/repo"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<!-- Requirements Checklist -->
				<div class="border-2 border-black rounded-lg p-4">
					<p class="font-bold mb-3">requirements</p>
					<ul class="space-y-2">
						<li class="flex items-center gap-2 text-sm">
							<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasName ? 'bg-black text-white' : ''}">
								{#if hasName}<Check size={12} />{/if}
							</span>
							<span class={hasName ? '' : 'text-gray-500'}>add a project name</span>
						</li>
						<li class="flex items-center gap-2 text-sm">
							<span class="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center {hasDescription ? 'bg-black text-white' : ''}">
								{#if hasDescription}<Check size={12} />{/if}
							</span>
							<span class={hasDescription ? '' : 'text-gray-500'}>write a description (min {DESC_MIN} chars)</span>
						</li>
					</ul>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={handleClose}
					disabled={loading || tutorialMode}
					class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				>
					cancel
				</button>
				<button
					onclick={handleSubmit}
					disabled={loading || !allRequirementsMet}
					class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
				>
					{loading ? 'creating...' : 'create'}
				</button>
			</div>
		</div>
	</div>
{/if}
