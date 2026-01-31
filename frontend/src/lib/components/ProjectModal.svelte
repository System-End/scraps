<script lang="ts">
	import { X, ChevronDown, Upload } from '@lucide/svelte'
	import { API_URL } from '$lib/config'

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
		project = $bindable<Project | null>(null),
		onClose,
		onSave
	}: {
		project: Project | null
		onClose: () => void
		onSave: (project: Project) => void
	} = $props()

	let editedProject = $state<Project | null>(null)
	let imagePreview = $state<string | null>(null)
	let uploadingImage = $state(false)
	let hackatimeProjects = $state<HackatimeProject[]>([])
	let loadingProjects = $state(false)
	let showDropdown = $state(false)
	let loading = $state(false)
	let error = $state<string | null>(null)

	async function fetchHackatimeProjects() {
		loadingProjects = true
		try {
			const response = await fetch(`${API_URL}/hackatime/projects`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				hackatimeProjects = data.projects || []
			}
		} catch (e) {
			console.error('Failed to fetch hackatime projects:', e)
		} finally {
			loadingProjects = false
		}
	}

	$effect(() => {
		if (project) {
			editedProject = { ...project }
			imagePreview = project.image
			error = null
			fetchHackatimeProjects()
		}
	})

	async function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement
		const file = input.files?.[0]
		if (!file || !editedProject) return

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

			if (editedProject) {
				editedProject.image = data.url
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to upload image'
			imagePreview = editedProject?.image || null
		} finally {
			uploadingImage = false
		}
	}

	function removeImage() {
		if (editedProject) {
			editedProject.image = null
		}
		imagePreview = null
	}

	function selectHackatimeProject(hp: HackatimeProject) {
		if (editedProject) {
			editedProject.hackatimeProject = hp.name
			editedProject.hours = hp.hours
			if (hp.repoUrl && !editedProject.githubUrl) {
				editedProject.githubUrl = hp.repoUrl
			}
		}
		showDropdown = false
	}

	async function handleSave() {
		if (!editedProject) return

		loading = true
		error = null

		try {
			const response = await fetch(`${API_URL}/projects/${editedProject.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({
					name: editedProject.name,
					description: editedProject.description,
					image: editedProject.image,
					githubUrl: editedProject.githubUrl,
					hackatimeProject: editedProject.hackatimeProject,
					hours: editedProject.hours
				})
			})

			if (!response.ok) {
				const data = await response.json().catch(() => ({}))
				throw new Error(data.message || 'Failed to save project')
			}

			const updatedProject = await response.json()
			onSave(updatedProject)
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save project'
		} finally {
			loading = false
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}
</script>

{#if project && editedProject}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold">edit project</h2>
				<button onclick={onClose} class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
					<X size={24} />
				</button>
			</div>

			{#if error}
				<div class="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-sm">
					{error}
				</div>
			{/if}

			<div class="space-y-4">
				<!-- Image Upload -->
				<div>
					<label class="block text-sm font-bold mb-1">image</label>
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
									class="absolute top-2 right-2 p-1 bg-white rounded-full border-2 border-black hover:bg-gray-100"
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

				<div>
					<label for="name" class="block text-sm font-bold mb-1">name</label>
					<input
						id="name"
						type="text"
						bind:value={editedProject.name}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="description" class="block text-sm font-bold mb-1">description</label>
					<textarea
						id="description"
						bind:value={editedProject.description}
						rows="3"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div>
					<label for="githubUrl" class="block text-sm font-bold mb-1">github url</label>
					<input
						id="githubUrl"
						type="url"
						bind:value={editedProject.githubUrl}
						placeholder="https://github.com/user/repo"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<!-- Hackatime Project Dropdown -->
				<div>
					<label class="block text-sm font-bold mb-1">hackatime project</label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed text-left flex items-center justify-between"
						>
							{#if loadingProjects}
								<span class="text-gray-500">loading projects...</span>
							{:else if editedProject.hackatimeProject}
								<span>{editedProject.hackatimeProject} <span class="text-gray-500">({editedProject.hours}h)</span></span>
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
									<button
										type="button"
										onclick={() => { if (editedProject) { editedProject.hackatimeProject = null; editedProject.hours = 0; } showDropdown = false }}
										class="w-full px-4 py-2 text-left hover:bg-gray-100 text-gray-500"
									>
										none
									</button>
									{#each hackatimeProjects as hp}
										<button
											type="button"
											onclick={() => selectHackatimeProject(hp)}
											class="w-full px-4 py-2 text-left hover:bg-gray-100 flex justify-between items-center"
										>
											<span class="font-medium">{hp.name}</span>
											<span class="text-gray-500 text-sm">{hp.hours}h</span>
										</button>
									{/each}
								{/if}
							</div>
						{/if}
					</div>
				</div>

			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={onClose}
					disabled={loading}
					class="flex-1 px-4 py-2 border-2 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50"
				>
					cancel
				</button>
				<button
					onclick={handleSave}
					disabled={loading}
					class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50"
				>
					{loading ? 'saving...' : 'save'}
				</button>
			</div>
		</div>
	</div>
{/if}
