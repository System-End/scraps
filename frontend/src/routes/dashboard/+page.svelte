<script lang="ts">
	import { onMount } from 'svelte'
	import { FilePlus2, Pencil } from '@lucide/svelte'
	import DashboardNavbar from '$lib/components/DashboardNavbar.svelte'
	import ProjectModal from '$lib/components/ProjectModal.svelte'
	

	interface Project {
		id: number
		userId: number
		name: string
		description: string
		imageUrl: string
		githubUrl: string
		hours: number
		hackatimeUrl: string
	}

	interface NewsItem {
		id: number
		date: string
		content: string
	}

	let projects = $state<Project[]>([])
	let latestNews = $state<NewsItem | null>(null)
	let selectedProject = $state<Project | null>(null)
	let screws = $state(42)

	const dummyProjects: Project[] = [
		{
			id: 1,
			userId: 1,
			name: 'Blueprint',
			description: 'A hackathon project for AMD',
			imageUrl: '/hero.png',
			githubUrl: 'https://github.com/hackclub/blueprint',
			hours: 24,
			hackatimeUrl: 'https://hackatime.hackclub.com/projects/blueprint'
		},
		{
			id: 2,
			userId: 1,
			name: 'Flavortown',
			description: 'A food discovery app',
			imageUrl: '/hero.png',
			githubUrl: 'https://github.com/hackclub/flavortown',
			hours: 18,
			hackatimeUrl: 'https://hackatime.hackclub.com/projects/flavortown'
		}
	]

	const dummyLatestNews: NewsItem = {
		id: 1,
		date: 'jan 21, 2026',
		content: 'remember to stay drafty!'
	}

	onMount(async () => {
		// TODO: Replace with actual API call to /api/projects
		// const response = await fetch('/api/projects', {
		//   headers: { 'Authorization': `Bearer ${userToken}` }
		// })
		// projects = await response.json()
		projects = dummyProjects

		// TODO: Replace with actual API call to /api/news/latest
		// const newsResponse = await fetch('/api/news/latest')
		// latestNews = await newsResponse.json()
		latestNews = dummyLatestNews

		// TODO: Fetch user's screw count
		// const userResponse = await fetch('/api/user')
		// screws = (await userResponse.json()).screws
	})

	function openEditModal(project: Project) {
		selectedProject = project
	}

	function closeModal() {
		selectedProject = null
	}

	function handleSaveProject(updatedProject: Project) {
		// TODO: Call API to update project
		// await fetch(`/api/projects/${updatedProject.id}`, {
		//   method: 'PUT',
		//   body: JSON.stringify(updatedProject)
		// })
		projects = projects.map((p) => (p.id === updatedProject.id ? updatedProject : p))
		closeModal()
	}

	function createNewProject() {
		// TODO: Navigate to project creation or open modal
		console.log('Create new project')
	}
</script>

<svelte:head>
	<title>dashboard | scraps</title>
</svelte:head>

<DashboardNavbar {screws} />

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<!-- Projects Section -->
	<div class="mb-12">
		<div class="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
			{#each projects as project (project.id)}
				<button
					onclick={() => openEditModal(project)}
					class="shrink-0 w-80 h-64 rounded-2xl border-4 border-black overflow-hidden relative group bg-[#1a365d] cursor-pointer transition-all hover:border-dashed"
				>
					<div class="absolute inset-0 flex items-center justify-center p-6">
						<img
							src={project.imageUrl}
							alt={project.name}
							class="max-w-full max-h-full object-contain"
						/>
					</div>
					<div
						class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 border-2 border-dashed border-black/50 rounded-full bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity"
					>
						<Pencil size={16} />
						<span class="font-bold">edit draft</span>
					</div>
				</button>
			{/each}

			<!-- New Draft Card -->
			<button
				onclick={createNewProject}
				class="shrink-0 w-80 h-64 rounded-2xl border-4 border-black flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:border-dashed bg-white"
			>
				<FilePlus2 size={64} strokeWidth={1.5} />
				<span class="text-2xl font-bold">new draft</span>
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

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
