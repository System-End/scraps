<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ArrowLeft,
		Github,
		Globe,
		Clock,
		CheckCircle,
		AlertTriangle,
		Package
	} from '@lucide/svelte';
	import { API_URL } from '$lib/config';
	import { formatHours } from '$lib/utils';
	import { getUser } from '$lib/auth-client';
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte';

	let { data } = $props();

	interface Project {
		id: number;
		name: string;
		description: string;
		image: string | null;
		githubUrl: string | null;
		playableUrl: string | null;
		hours: number;
		status: string;
		createdAt: string;
	}

	interface Owner {
		id: number;
		username: string | null;
		avatar: string | null;
	}

	let project = $state<Project | null>(null);
	let owner = $state<Owner | null>(null);
	let isOwner = $state(false);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		const user = await getUser();
		if (!user) {
			window.location.href = '/';
			return;
		}

		try {
			const response = await fetch(`${API_URL}/projects/${data.id}/public`, {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Project not found');
			}

			const result = await response.json();
			if (result.error) {
				throw new Error(result.error);
			}

			project = result.project;
			owner = result.owner;
			isOwner = result.isOwner;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load project';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>{project?.name || 'project'} - scraps</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 pt-24 pb-24 md:px-12">
	{#if owner}
		<a
			href="/users/{owner.id}"
			class="mb-8 inline-flex cursor-pointer items-center gap-2 font-bold hover:underline"
		>
			<ArrowLeft size={20} />
			back to {owner.username}'s profile
		</a>
	{:else}
		<a
			href="/leaderboard"
			class="mb-8 inline-flex cursor-pointer items-center gap-2 font-bold hover:underline"
		>
			<ArrowLeft size={20} />
			back
		</a>
	{/if}

	{#if loading}
		<div class="py-12 text-center text-gray-500">loading...</div>
	{:else if error}
		<div class="py-12 text-center text-gray-500">{error}</div>
	{:else if project}
		<!-- Project Image -->
		<div class="mb-6 h-64 w-full overflow-hidden rounded-2xl border-4 border-black md:h-80">
			{#if project.image}
				<img src={project.image} alt={project.name} class="h-full w-full object-cover" />
			{:else}
				<ProjectPlaceholder seed={project.id} />
			{/if}
		</div>

		<!-- Project Info -->
		<div class="mb-6 rounded-2xl border-4 border-black p-6">
			<div class="mb-2 flex items-start justify-between">
				<h1 class="text-3xl font-bold">{project.name}</h1>
				{#if project.status === 'shipped'}
					<span
						class="flex items-center gap-1 rounded-full border-2 border-green-600 bg-green-100 px-3 py-1 text-sm font-bold text-green-700"
					>
						<CheckCircle size={14} />
						shipped
					</span>
				{:else}
					<span
						class="flex items-center gap-1 rounded-full border-2 border-yellow-600 bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-700"
					>
						<AlertTriangle size={14} />
						in progress
					</span>
				{/if}
			</div>
			<p class="mb-4 text-gray-600">{project.description}</p>
			<div class="flex flex-wrap items-center gap-3 text-sm">
				<span
					class="flex items-center gap-1 rounded-full border-2 border-black bg-gray-100 px-3 py-1 font-bold"
				>
					<Clock size={14} />
					{formatHours(project.hours)}h
				</span>
			</div>

			<div class="mt-4 flex flex-wrap gap-3">
				{#if project.githubUrl}
					<a
						href={project.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex cursor-pointer items-center gap-2 rounded-full border-4 border-black px-4 py-2 font-bold transition-all duration-200 hover:border-dashed"
					>
						<Github size={18} />
						<span>view on github</span>
					</a>
				{:else}
					<span
						class="inline-flex cursor-not-allowed items-center gap-2 rounded-full border-4 border-dashed border-gray-300 px-4 py-2 font-bold text-gray-400"
					>
						<Github size={18} />
						<span>view on github</span>
					</span>
				{/if}
				{#if project.playableUrl}
					<a
						href={project.playableUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex cursor-pointer items-center gap-2 rounded-full border-4 border-black px-4 py-2 font-bold transition-all duration-200 hover:border-dashed"
					>
						<Globe size={18} />
						<span>try it out</span>
					</a>
				{:else}
					<span
						class="inline-flex cursor-not-allowed items-center gap-2 rounded-full border-4 border-dashed border-gray-300 px-4 py-2 font-bold text-gray-400"
					>
						<Globe size={18} />
						<span>try it out</span>
					</span>
				{/if}
			</div>

			{#if isOwner}
				<a
					href="/projects/{project.id}"
					class="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border-4 border-black bg-black px-4 py-2 font-bold text-white transition-all duration-200 hover:bg-gray-800"
				>
					edit project
				</a>
			{/if}
		</div>

		<!-- Owner Info -->
		{#if owner}
			<div class="rounded-2xl border-4 border-black p-6">
				<h2 class="mb-4 text-xl font-bold">created by</h2>
				<a
					href="/users/{owner.id}"
					class="flex cursor-pointer items-center gap-4 transition-all duration-200 hover:opacity-80"
				>
					{#if owner.avatar}
						<img src={owner.avatar} alt="" class="h-12 w-12 rounded-full border-2 border-black" />
					{:else}
						<div class="h-12 w-12 rounded-full border-2 border-black bg-gray-200"></div>
					{/if}
					<span class="text-lg font-bold">{owner.username || 'unknown'}</span>
				</a>
			</div>
		{/if}
	{/if}
</div>
