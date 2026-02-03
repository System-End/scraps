<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ArrowLeft, ChevronDown, Upload, X, Save, Check, Trash2 } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'
	import { invalidateAllStores } from '$lib/stores'

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
	}

	interface HackatimeProject {
		name: string
		hours: number
		repoUrl: string | null
		languages: string[]
	}

	let project = $state<Project | null>(null)
	let loading = $state(true)
	let saving = $state(false)
	let deleting = $state(false)
	let showDeleteConfirm = $state(false)
	let error = $state<string | null>(null)
	let imagePreview = $state<string | null>(null)
	let uploadingImage = $state(false)
	let hackatimeProjects = $state<HackatimeProject[]>([])
	let userSlackId = $state<string | null>(null)
	let selectedHackatimeName = $state<string | null>(null)
	let loadingProjects = $state(false)
	let showDropdown = $state(false)

	const NAME_MAX = 50
	const DESC_MIN = 20
	const DESC_MAX = 1000

	let hasDescription = $derived((project?.description?.trim().length ?? 0) >= DESC_MIN && (project?.description?.trim().length ?? 0) <= DESC_MAX)
	let hasName = $derived((project?.name?.trim().length ?? 0) > 0 && (project?.name?.trim().length ?? 0) <= NAME_MAX)
	let canSave = $derived(hasDescription && hasName)

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
			project = responseData.project
			imagePreview = project?.image || null
			if (project?.hackatimeProject) {
				const parts = project.hackatimeProject.split('/')
				selectedHackatimeName = parts.length > 1 ? parts.slice(1).join('/') : parts[0]
			}
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

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file || !project) return

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

			const responseData = await response.json()
			if (responseData.error) {
				throw new Error(responseData.error)
			}

			project.image = responseData.url
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to upload image'
			imagePreview = project?.image || null
		} finally {
			uploadingImage = false
		}
	}

	function removeImage() {
		if (project) {
			project.image = null
		}
		imagePreview = null
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

	async function handleSave() {
		if (!project || !canSave) return

		saving = true
		error = null

		const hackatimeValue = selectedHackatimeName && userSlackId
			? `${userSlackId}/${selectedHackatimeName}`
			: null

		try {
			const response = await fetch(`${API_URL}/projects/${project.id}`, {
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
					hackatimeProject: hackatimeValue
				})
			})

			if (!response.ok) {
				const responseData = await response.json().catch(() => ({}))
				throw new Error(responseData.message || 'Failed to save project')
			}

			invalidateAllStores()
			goto(`/projects/${project.id}`)
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save project'
		} finally {
			saving = false
		}
	}

	async function handleDelete() {
		if (!project) return

		deleting = true
		error = null

		try {
			const response = await fetch(`${API_URL}/projects/${project.id}`, {
				method: 'DELETE',
				credentials: 'include'
			})

			if (!response.ok) {
				const responseData = await response.json().catch(() => ({}))
				throw new Error(responseData.message || 'Failed to delete project')
			}

			invalidateAllStores()
			goto('/dashboard')
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete project'
			showDeleteConfirm = false
		} finally {
			deleting = false
		}
	}
</script>

<svelte:head>
	<title>edit {project?.name || 'project'} - scraps</title>
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
		<div class="border-8 border-black rounded-2xl p-6 bg-white">
			<h1 class="text-3xl font-bold mb-6">edit project</h1>

			{#if error}
				<div class="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-sm">
					{error}
				</div>
			{/if}

			<div class="space-y-6">
				<!-- Image Upload -->
				<div>
					<label class="block text-sm font-bold mb-2">image <span class="text-red-500">*</span></label>
					{#if imagePreview}
						<div class="relative w-full h-48 border-2 border-black rounded-lg overflow-hidden">
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
						<label class="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-black rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
							<Upload size={32} class="text-gray-400 mb-2" />
							<span class="text-sm text-gray-500">click to upload image</span>
							<input type="file" accept="image/*" onchange={handleImageUpload} class="hidden" />
						</label>
					{/if}
				</div>

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
					<label for="githubUrl" class="block text-sm font-bold mb-2">github url <span class="text-gray-400">(optional)</span></label>
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
					<label for="playableUrl" class="block text-sm font-bold mb-2">playable url <span class="text-gray-400">(required for submission)</span></label>
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
					<label class="block text-sm font-bold mb-2">hackatime project <span class="text-gray-400">(optional)</span></label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="w-full px-4 py-3 border-2 border-black rounded-lg focus:outline-none focus:border-dashed text-left flex items-center justify-between"
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

			<!-- Actions -->
			<div class="flex gap-4 mt-8">
				<a
					href="/projects/{data.id}"
					class="flex-1 px-4 py-3 border-4 border-black rounded-full font-bold text-center hover:border-dashed transition-all duration-200 cursor-pointer"
				>
					cancel
				</a>
				<button
					onclick={handleSave}
					disabled={saving || !canSave}
					class="flex-1 px-4 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
				>
					<Save size={18} />
					{saving ? 'saving...' : 'save changes'}
				</button>
			</div>

			<!-- Danger Zone -->
			<div class="mt-12 pt-8 border-t-4 border-dashed border-gray-300">
				<h2 class="text-xl font-bold text-red-600 mb-4">danger zone</h2>
				<div class="border-4 border-red-500 rounded-2xl p-6">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="font-bold">delete this project</h3>
							<p class="text-sm text-gray-600">once deleted, this project cannot be recovered.</p>
						</div>
						<button
							onclick={() => (showDeleteConfirm = true)}
							class="px-4 py-2 border-4 border-red-500 text-red-600 rounded-full font-bold hover:bg-red-50 transition-all duration-200 cursor-pointer flex items-center gap-2"
						>
							<Trash2 size={18} />
							delete
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Delete Confirmation Modal -->
		{#if showDeleteConfirm}
			<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
				<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black">
					<h2 class="text-2xl font-bold mb-4">are you sure?</h2>
					<p class="text-gray-700 mb-6">
						this will permanently delete <strong>{project.name}</strong>. this action cannot be undone.
					</p>
					<div class="flex gap-4">
						<button
							onclick={() => (showDeleteConfirm = false)}
							disabled={deleting}
							class="flex-1 px-4 py-3 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 cursor-pointer disabled:opacity-50"
						>
							cancel
						</button>
						<button
							onclick={handleDelete}
							disabled={deleting}
							class="flex-1 px-4 py-3 bg-red-600 text-white border-4 border-red-600 rounded-full font-bold hover:bg-red-700 transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
						>
							<Trash2 size={18} />
							{deleting ? 'deleting...' : 'delete project'}
						</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
