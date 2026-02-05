<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { FilePlus2 } from '@lucide/svelte';
	import CreateProjectModal from '$lib/components/CreateProjectModal.svelte';
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte';
	import NewsCarousel from '$lib/components/NewsCarousel.svelte';
	import { getUser } from '$lib/auth-client';
	import {
		projectsStore,
		projectsLoading,
		fetchProjects,
		addProject,
		tutorialActiveStore,
		type Project
	} from '$lib/stores';
	import { formatHours } from '$lib/utils';

	const greetingPhrases = [
		'ready to scrap?',
		'time to build something silly',
		'what will you ship today?',
		'let the scrapping begin',
		'hack away!',
		'make something fun',
		'create, ship, repeat',
		'keep on scrapping'
	];

	const randomPhrase = greetingPhrases[Math.floor(Math.random() * greetingPhrases.length)];

	let user = $state<Awaited<ReturnType<typeof getUser>>>(null);
	let showCreateModal = $state(false);

	onMount(async () => {
		const userData = await getUser();
		if (!userData) {
			goto('/');
			return;
		}
		user = userData;
		fetchProjects();
	});

	function createNewProject() {
		showCreateModal = true;
	}

	function handleProjectCreated(newProject: Project) {
		addProject(newProject);
		showCreateModal = false;
	}
</script>

<svelte:head>
	<title>dashboard - scraps</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-6 pt-24 pb-24 md:px-12">
	<!-- Greeting -->
	{#if user}
		<h1 class="mb-2 text-4xl font-bold md:text-5xl">
			hello, {(user.username || 'friend').toLocaleLowerCase()}
		</h1>
		<p class="mb-8 text-lg text-gray-600">{randomPhrase}</p>
	{/if}

	<!-- Projects Section -->
	<div class="mb-12">
		<div class="scrollbar-black flex gap-6 overflow-x-auto pb-4">
			{#each $projectsStore as project (project.id)}
				<a
					href="/projects/{project.id}"
					class="group relative flex h-64 w-80 shrink-0 cursor-pointer flex-col overflow-hidden rounded-2xl border-4 border-black bg-white transition-all hover:border-dashed"
				>
					<div class="flex-1 overflow-hidden">
						{#if project.image}
							<img src={project.image} alt={project.name} class="h-full w-full object-cover" />
						{:else}
							<ProjectPlaceholder seed={project.id} />
						{/if}
					</div>
					<div class="border-t-2 border-black bg-white px-4 py-3">
						<div class="mb-1 flex items-center justify-between">
							<span class="truncate text-lg font-bold">{project.name}</span>
							<span class="shrink-0 text-sm text-gray-500">{formatHours(project.hours)}h</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
								tier {project.tier}
							</span>
							<span
								class="rounded-full px-2 py-0.5 text-xs {project.status === 'shipped'
									? 'bg-green-100'
									: project.status === 'waiting_for_review'
										? 'bg-yellow-100'
										: 'bg-gray-100'}"
							>
								{project.status.replace(/_/g, ' ')}
							</span>
						</div>
					</div>
				</a>
			{/each}

			<!-- New Draft Card -->
			<button
				onclick={createNewProject}
				data-tutorial="new-project"
				class="flex h-64 w-80 shrink-0 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-4 border-dashed border-black bg-white transition-all hover:border-solid"
			>
				<FilePlus2 size={64} strokeWidth={1.5} />
				<span class="text-2xl font-bold">new project</span>
			</button>
		</div>
	</div>

	<!-- News Carousel -->
	<NewsCarousel />

	<!-- FAQ Section -->
	<div class="mt-12">
		<h2 class="mb-6 text-3xl font-bold">faq</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<div
				class="rounded-2xl border-4 border-black bg-white p-6 transition-all hover:border-dashed"
			>
				<p class="mb-2 text-lg font-bold">how does the shop work?</p>
				<p class="text-gray-600">
					spend scraps to roll for prizes. each item has a probability of winning - boost your odds
					in the refinery!
				</p>
			</div>

			<div
				class="rounded-2xl border-4 border-black bg-white p-6 transition-all hover:border-dashed"
			>
				<p class="mb-2 text-lg font-bold">what is hackatime?</p>
				<p class="text-gray-600">
					<a
						href="https://hackatime.hackclub.com"
						target="_blank"
						rel="noopener noreferrer"
						class="underline hover:no-underline">hackatime</a
					> is hack club's time tracking tool that automatically logs your coding hours.
				</p>
			</div>

			<div
				class="rounded-2xl border-4 border-black bg-white p-6 transition-all hover:border-dashed"
			>
				<p class="mb-2 text-lg font-bold">what is the refinery?</p>
				<p class="text-gray-600">
					spend scraps to increase your probability of winning an item. each upgrade boosts your
					chances!
				</p>
			</div>

			<div
				class="rounded-2xl border-4 border-black bg-white p-6 transition-all hover:border-dashed"
			>
				<p class="mb-2 text-lg font-bold">what are project tiers?</p>
				<p class="text-gray-600">
					tiers 1-4 based on complexity. tier 1 = 0.8x, tier 2 = 1x, tier 3 = 1.25x, tier 4 = 1.5x
					multiplier.
				</p>
			</div>

			<div
				class="rounded-2xl border-4 border-black bg-white p-6 transition-all hover:border-dashed"
			>
				<p class="mb-2 text-lg font-bold">what happens if i lose a roll?</p>
				<p class="text-gray-600">
					you receive consolation scrap paper. your refinery upgrades are kept, so try again!
				</p>
			</div>

			<a
				href="/faq"
				class="flex items-center justify-center rounded-2xl border-4 border-black bg-white p-6 transition-all hover:border-dashed"
			>
				<p class="text-lg font-bold">more questions? →</p>
			</a>
		</div>
	</div>
</div>

<CreateProjectModal
	open={showCreateModal}
	onClose={() => (showCreateModal = false)}
	onCreated={handleProjectCreated}
	tutorialMode={$tutorialActiveStore}
/>

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
