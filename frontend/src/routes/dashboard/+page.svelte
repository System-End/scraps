<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { FilePlus2 } from '@lucide/svelte'
	import CreateProjectModal from '$lib/components/CreateProjectModal.svelte'
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte'
	import NewsCarousel from '$lib/components/NewsCarousel.svelte'
	import { getUser } from '$lib/auth-client'
	import {
		projectsStore,
		projectsLoading,
		fetchProjects,
		addProject,
		tutorialActiveStore,
		type Project
	} from '$lib/stores'
	import { formatHours } from '$lib/utils'

	const greetingPhrases = [
		'ready to scrap?',
		'time to build something silly',
		'what will you ship today?',
		'let the scrapping begin',
		'hack away!',
		'make something fun',
		'create, ship, repeat',
		'keep on scrapping'
	]

	const randomPhrase = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)]

	let user = $state<Awaited<ReturnType<typeof getUser>>>(null)
	let showCreateModal = $state(false)

	onMount(async () => {
		const userData = await getUser()
		if (!userData) {
			goto('/')
			return
		}
		user = userData
		fetchProjects()
	})

	function createNewProject() {
		showCreateModal = true
	}

	function handleProjectCreated(newProject: Project) {
		addProject(newProject)
		showCreateModal = false
	}
</script>

<svelte:head>
	<title>dashboard - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<!-- Greeting -->
	{#if user}
		<h1 class="text-4xl md:text-5xl font-bold mb-2">hello, {(user.username || 'friend').toLocaleLowerCase()}</h1>
		<p class="text-lg text-gray-600 mb-8">{randomPhrase}</p>
	{/if}

	<!-- Projects Section -->
	<div class="mb-12">
		<div class="flex gap-6 overflow-x-auto pb-4 scrollbar-black">
			{#each $projectsStore as project (project.id)}
				<a
					href="/projects/{project.id}"
					class="shrink-0 w-80 h-64 rounded-2xl border-4 border-black overflow-hidden relative group bg-white cursor-pointer transition-all hover:border-dashed flex flex-col"
				>
					<div class="flex-1 overflow-hidden">
						{#if project.image}
							<img
								src={project.image}
								alt={project.name}
								class="w-full h-full object-cover"
							/>
						{:else}
							<ProjectPlaceholder seed={project.id} />
						{/if}
					</div>
					<div class="px-4 py-3 border-t-2 border-black bg-white">
						<div class="flex items-center justify-between mb-1">
							<span class="font-bold text-lg truncate">{project.name}</span>
							<span class="text-gray-500 text-sm shrink-0">{formatHours(project.hours)}h</span>
						</div>
						<span class="text-xs px-2 py-0.5 rounded-full {project.status === 'shipped' ? 'bg-green-100' : project.status === 'waiting_for_review' ? 'bg-yellow-100' : 'bg-gray-100'}">
							{project.status.replace(/_/g, ' ')}
						</span>
					</div>
				</a>
			{/each}

			<!-- New Draft Card -->
			<button
				onclick={createNewProject}
				data-tutorial="new-project"
				class="shrink-0 w-80 h-64 rounded-2xl border-4 border-black flex flex-col items-center justify-center gap-4 cursor-pointer transition-all  border-dashed hover:border-solid bg-white"
			>
				<FilePlus2 size={64} strokeWidth={1.5} />
				<span class="text-2xl font-bold">new project</span>
			</button>
		</div>
	</div>

	<!-- News Carousel -->
	<NewsCarousel />
</div>

<CreateProjectModal open={showCreateModal} onClose={() => showCreateModal = false} onCreated={handleProjectCreated} tutorialMode={$tutorialActiveStore} />

<style>
	.scrollbar-black {
		scrollbar-width: thin;
		scrollbar-color: black transparent;
	}
	.scrollbar-black::-webkit-scrollbar {
		height: 4px;
	}
	.scrollbar-black::-webkit-scrollbar-track {
		background: transparent;
	}
	.scrollbar-black::-webkit-scrollbar-thumb {
		background-color: black;
		border-radius: 9999px;
	}
</style>
