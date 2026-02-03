<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ChevronDown, Send } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'
	import { formatHours } from '$lib/utils'

	interface Project {
		id: number
		name: string
		description: string
		image: string | null
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
	let projects = $state<Project[]>([])
	let selectedProject = $state<Project | null>(null)
	let showDropdown = $state(false)
	let submitting = $state(false)
	let error = $state<string | null>(null)
	let scraps = $derived(user?.scraps ?? 0)

	let eligibleProjects = $derived(projects.filter((p) => p.status === 'in_progress'))

	onMount(async () => {
		user = await getUser()
		if (!user) {
			goto('/')
			return
		}

		try {
			const response = await fetch(`${API_URL}/projects?limit=100`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				if (data.data) {
					projects = data.data
				}
			}
		} catch (e) {
			console.error('Failed to fetch projects:', e)
		}
	})

	async function submitProject() {
		if (!selectedProject) {
			error = 'Please select a project'
			return
		}

		submitting = true
		error = null

		try {
			const response = await fetch(`${API_URL}/projects/${selectedProject.id}/submit`, {
				method: 'POST',
				credentials: 'include'
			})

			const data = await response.json()
			if (data.error) {
				throw new Error(data.error)
			}

			goto('/dashboard')
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit project'
		} finally {
			submitting = false
		}
	}
</script>

<svelte:head>
	<title>submit project - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-2xl mx-auto pb-24">
	<h1 class="text-4xl md:text-5xl font-bold mb-4">submit project</h1>
	<p class="text-lg text-gray-600 mb-8">submit your project for review to earn scraps</p>

	{#if error}
		<div class="mb-6 p-4 bg-red-100 border-2 border-red-500 rounded-lg text-red-700">
			{error}
		</div>
	{/if}

	<div class="space-y-6">
		<div>
			<label class="block text-sm font-bold mb-2">select project</label>
			<div class="relative">
				<button
					type="button"
					onclick={() => (showDropdown = !showDropdown)}
					class="w-full px-4 py-3 border-4 border-black rounded-lg text-left flex items-center justify-between hover:border-dashed transition-all cursor-pointer"
				>
					{#if selectedProject}
						<span class="font-bold">{selectedProject.name}</span>
					{:else}
						<span class="text-gray-500">choose a project...</span>
					{/if}
					<ChevronDown
						size={20}
						class={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'}
					/>
				</button>

				{#if showDropdown}
					<div
						class="absolute top-full left-0 right-0 mt-2 bg-white border-4 border-black rounded-lg max-h-64 overflow-y-auto z-10"
					>
						{#if eligibleProjects.length === 0}
							<div class="px-4 py-3 text-gray-500">no eligible projects</div>
						{:else}
							{#each eligibleProjects as project}
								<button
									type="button"
									onclick={() => {
										selectedProject = project
										showDropdown = false
									}}
									class="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors flex justify-between items-center cursor-pointer"
								>
									<span class="font-bold">{project.name}</span>
									<span class="text-gray-500 text-sm">{formatHours(project.hours)}h</span>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		</div>

		{#if selectedProject}
			<div class="border-4 border-black rounded-2xl p-6">
				<h3 class="font-bold text-xl mb-2">{selectedProject.name}</h3>
				<p class="text-gray-600 mb-4">{selectedProject.description}</p>
				<div class="flex items-center gap-4 text-sm">
					<span class="px-3 py-1 bg-gray-100 rounded-full font-bold">{formatHours(selectedProject.hours)}h logged</span>
					<span class="px-3 py-1 bg-gray-100 rounded-full font-bold">{selectedProject.status}</span>
				</div>
			</div>
		{/if}

		<button
			onclick={submitProject}
			disabled={submitting || !selectedProject}
			class="w-full px-6 py-4 bg-black text-white rounded-full font-bold text-lg hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
		>
			<Send size={20} />
			<span>{submitting ? 'submitting...' : 'submit for review'}</span>
		</button>
	</div>
</div>
