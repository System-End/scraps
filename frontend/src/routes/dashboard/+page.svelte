<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { FilePlus2, Pencil } from '@lucide/svelte'
	import DashboardNavbar from '$lib/components/DashboardNavbar.svelte'
	import ProjectModal from '$lib/components/ProjectModal.svelte'
	import CreateProjectModal from '$lib/components/CreateProjectModal.svelte'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'
	import { getUser } from '$lib/auth-client'
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
	}

	interface NewsItem {
		id: number
		date: string
		content: string
	}

	interface User {
		id: number
		username: string
		email: string
		avatar: string
		slackId: string
		scraps: number
	}

	let user = $state<User | null>(null)
	let projects = $state<Project[]>([])
	let latestNews = $state<NewsItem | null>(null)
	let selectedProject = $state<Project | null>(null)
	let showCreateModal = $state(false)
	let screws = $derived(user?.scraps ?? 0)

	onMount(async () => {
		const userData = await getUser()
		if (!userData) {
			goto('/')
			return
		}
		user = userData

		// Fetch user's projects
		try {
			const projectsResponse = await fetch(`${API_URL}/projects`, {
				credentials: 'include'
			})
			if (projectsResponse.ok) {
				const data = await projectsResponse.json()
				if (Array.isArray(data)) {
					projects = data
				}
			}
		} catch (e) {
			console.error('Failed to fetch projects:', e)
		}

		// Fetch latest news
		try {
			const newsResponse = await fetch(`${API_URL}/news/latest`, {
				credentials: 'include'
			})
			if (newsResponse.ok) {
				latestNews = await newsResponse.json()
			}
		} catch (e) {
			console.error('Failed to fetch news:', e)
		}
	})

	function openEditModal(project: Project) {
		selectedProject = project
	}

	function closeModal() {
		selectedProject = null
	}

	async function handleSaveProject(updatedProject: Project) {
		projects = projects.map((p) => (p.id === updatedProject.id ? updatedProject : p))
		closeModal()
	}

	function createNewProject() {
		showCreateModal = true
	}

	function handleProjectCreated(newProject: Project) {
		projects = [...projects, newProject]
		showCreateModal = false
	}
</script>

<svelte:head>
	<title>dashboard | scraps</title>
</svelte:head>

<DashboardNavbar {screws} {user} />

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<!-- Greeting -->
	{#if user}
		<h1 class="text-4xl md:text-5xl font-bold mb-8">hello, {user.username || 'friend'}</h1>
	{/if}

	<!-- Projects Section -->
	<div class="mb-12">
		<div class="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
			{#each projects as project (project.id)}
				<button
					onclick={() => openEditModal(project)}
					class="shrink-0 w-80 h-64 rounded-2xl border-4 border-black overflow-hidden relative group bg-white cursor-pointer transition-all hover:border-dashed flex flex-col"
				>
					<div class="flex-1 flex items-center justify-center p-6 overflow-hidden">
						{#if project.image}
							<img
								src={project.image}
								alt={project.name}
								class="max-w-full max-h-full object-contain"
							/>
						{:else}
							<ProjectPlaceholder seed={project.id} />
						{/if}
					</div>
					<div class="px-4 py-3 border-t-2 border-black bg-white flex items-center justify-between">
						<span class="font-bold text-lg truncate">{project.name}</span>
						<span class="text-gray-500 text-sm shrink-0">{project.hours}h</span>
					</div>
					<div
						class="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 border-2 border-dashed border-black/50 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
					>
						<Pencil size={16} />
						<span class="font-bold">edit project</span>
					</div>
				</button>
			{/each}

			<!-- New Draft Card -->
			<button
				onclick={createNewProject}
				class="shrink-0 w-80 h-64 rounded-2xl border-4 border-black flex flex-col items-center justify-center gap-4 cursor-pointer transition-all  border-dashed hover:border-solid bg-white"
			>
				<FilePlus2 size={64} strokeWidth={1.5} />
				<span class="text-2xl font-bold">new project</span>
			</button>
		</div>
	</div>

	<!-- News Section -->
	{#if latestNews}
		<div class="mb-16">
			<div class="border-4 border-black rounded-2xl p-8 text-center">
				<p class="text-lg font-bold mb-2">{latestNews.date}</p>
				<p class="text-2xl md:text-3xl font-bold">{latestNews.content}</p>
			</div>
		</div>
	{/if}

	<!-- Shop Sections -->
	<div class="mb-16">
		<h2 class="text-4xl font-bold mb-6">shop</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<a href="/shop" class="border-4 border-black rounded-2xl p-6 hover:border-dashed transition-all">
				<h3 class="text-2xl font-bold mb-2">items</h3>
				<p class="text-gray-600">browse available scraps</p>
			</a>
			<a href="/refinery" class="border-4 border-black rounded-2xl p-6 hover:border-dashed transition-all">
				<h3 class="text-2xl font-bold mb-2">refinery</h3>
				<p class="text-gray-600">upgrade your scraps</p>
			</a>
		</div>
	</div>

</div>

<ProjectModal project={selectedProject} onClose={closeModal} onSave={handleSaveProject} />
<CreateProjectModal open={showCreateModal} onClose={() => showCreateModal = false} onCreated={handleProjectCreated} />

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
