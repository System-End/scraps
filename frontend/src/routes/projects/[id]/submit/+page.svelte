<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Send, Check, ChevronDown } from '@lucide/svelte';
	import { getUser } from '$lib/auth-client';
	import { API_URL } from '$lib/config';
	import { formatHours } from '$lib/utils';

	let { data } = $props();

	interface Project {
		id: number;
		userId: string;
		name: string;
		description: string;
		image: string | null;
		githubUrl: string | null;
		playableUrl: string | null;
		hackatimeProject: string | null;
		hours: number;
		status: string;
		tier: number;
	}

	const TIERS = [
		{ value: 1, description: 'simple projects, tutorials, small scripts' },
		{ value: 2, description: 'moderate complexity, multi-file projects' },
		{ value: 3, description: 'complex features, APIs, integrations' },
		{ value: 4, description: 'full applications, major undertakings' }
	];

	interface HackatimeProject {
		name: string;
		hours: number;
		repoUrl: string | null;
		languages: string[];
	}

	let project = $state<Project | null>(null);
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let hackatimeProjects = $state<HackatimeProject[]>([]);
	let userSlackId = $state<string | null>(null);
	let selectedHackatimeName = $state<string | null>(null);
	let loadingProjects = $state(false);
	let showDropdown = $state(false);
	let selectedTier = $state(1);

	const NAME_MAX = 50;
	const DESC_MIN = 20;
	const DESC_MAX = 1000;

	let hasImage = $derived(!!project?.image);
	let hasHackatime = $derived(!!selectedHackatimeName);
	let hasGithub = $derived(!!project?.githubUrl?.trim());
	let hasPlayableUrl = $derived(!!project?.playableUrl?.trim());
	let hasDescription = $derived(
		(project?.description?.trim().length ?? 0) >= DESC_MIN &&
			(project?.description?.trim().length ?? 0) <= DESC_MAX
	);
	let hasName = $derived(
		(project?.name?.trim().length ?? 0) > 0 && (project?.name?.trim().length ?? 0) <= NAME_MAX
	);
	let allRequirementsMet = $derived(
		hasImage && hasHackatime && hasGithub && hasPlayableUrl && hasDescription && hasName
	);

	onMount(async () => {
		const user = await getUser();
		if (!user) {
			goto('/');
			return;
		}

		try {
			const response = await fetch(`${API_URL}/projects/${data.id}`, {
				credentials: 'include'
			});
			if (!response.ok) {
				throw new Error('Project not found');
			}
			const responseData = await response.json();
			if (responseData.error) {
				throw new Error(responseData.error);
			}
			if (!responseData.isOwner) {
				throw new Error('You can only submit your own projects');
			}
			project = responseData.project;
			if (project?.hackatimeProject) {
				const parts = project.hackatimeProject.split('/');
				selectedHackatimeName = parts.length > 1 ? parts.slice(1).join('/') : parts[0];
			}
			selectedTier = project?.tier ?? 1;
			fetchHackatimeProjects();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load project';
		} finally {
			loading = false;
		}
	});

	async function fetchHackatimeProjects() {
		loadingProjects = true;
		try {
			const response = await fetch(`${API_URL}/hackatime/projects`, {
				credentials: 'include'
			});
			if (response.ok) {
				const apiData = await response.json();
				hackatimeProjects = apiData.projects || [];
				userSlackId = apiData.slackId || null;
			}
		} catch (e) {
			console.error('Failed to fetch hackatime projects:', e);
		} finally {
			loadingProjects = false;
		}
	}

	function selectHackatimeProject(hp: HackatimeProject) {
		if (project) {
			selectedHackatimeName = hp.name;
			project.hours = hp.hours;
			if (hp.repoUrl && !project.githubUrl) {
				project.githubUrl = hp.repoUrl;
			}
		}
		showDropdown = false;
	}

	async function handleSubmit() {
		if (!project || !allRequirementsMet) return;

		submitting = true;
		error = null;

		const hackatimeValue =
			selectedHackatimeName && userSlackId ? `${userSlackId}/${selectedHackatimeName}` : null;

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
			});

			if (!updateResponse.ok) {
				const responseData = await updateResponse.json().catch(() => ({}));
				throw new Error(responseData.message || 'Failed to update project');
			}

			// Then submit for review
			const submitResponse = await fetch(`${API_URL}/projects/${project.id}/submit`, {
				method: 'POST',
				credentials: 'include'
			});

			const submitData = await submitResponse.json().catch(() => ({}));

			if (submitData.error === 'ineligible' && submitData.redirectTo) {
				goto(submitData.redirectTo);
				return;
			}

			if (!submitResponse.ok) {
				throw new Error(submitData.message || 'Failed to submit project');
			}

			goto(`/projects/${project.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit project';
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>submit {project?.name || 'project'} - scraps</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 pt-24 pb-24 md:px-12">
	<a
		href="/projects/{data.id}"
		class="mb-8 inline-flex cursor-pointer items-center gap-2 font-bold hover:underline"
	>
		<ArrowLeft size={20} />
		back to project
	</a>

	{#if loading}
		<div class="py-12 text-center">
			<p class="text-lg text-gray-500">loading project...</p>
		</div>
	{:else if error && !project}
		<div class="py-12 text-center">
			<p class="text-lg text-red-600">{error}</p>
			<a href="/dashboard" class="mt-4 inline-block font-bold underline">go back</a>
		</div>
	{:else if project}
		<div class="rounded-2xl border-4 border-black bg-white p-6">
			<h1 class="mb-2 text-3xl font-bold">submit for review</h1>
			<p class="mb-6 text-gray-600">
				make sure your project meets all requirements before submitting
			</p>

			{#if error}
				<div class="mb-4 rounded-lg border-2 border-red-500 bg-red-100 p-3 text-sm text-red-700">
					{error}
				</div>
			{/if}

			<!-- Project Image Preview -->
			<div class="mb-6">
				<label class="mb-2 block text-sm font-bold">project image</label>
				{#if project.image}
					<img
						src={project.image}
						alt={project.name}
						class="h-48 w-full rounded-lg border-2 border-black bg-gray-50 object-contain"
					/>
				{:else}
					<div
						class="flex h-48 w-full items-center justify-center rounded-lg border-2 border-black bg-gray-200 text-gray-400"
					>
						no image - <a href="/projects/{project.id}/edit" class="ml-1 underline"
							>add one in edit</a
						>
					</div>
				{/if}
			</div>

			<!-- Editable Fields -->
			<div class="mb-6 space-y-4">
				<!-- Name -->
				<div>
					<label for="name" class="mb-2 block text-sm font-bold"
						>name <span class="text-red-500">*</span></label
					>
					<input
						id="name"
						type="text"
						bind:value={project.name}
						maxlength={NAME_MAX}
						class="w-full rounded-lg border-2 border-black px-4 py-3 focus:border-dashed focus:outline-none"
					/>
					<p class="mt-1 text-right text-xs text-gray-500">{project.name.length}/{NAME_MAX}</p>
				</div>

				<!-- Description -->
				<div>
					<label for="description" class="mb-2 block text-sm font-bold"
						>description <span class="text-red-500">*</span></label
					>
					<textarea
						id="description"
						bind:value={project.description}
						rows="4"
						maxlength={DESC_MAX}
						class="w-full resize-none rounded-lg border-2 border-black px-4 py-3 focus:border-dashed focus:outline-none"
					></textarea>
					<p
						class="mt-1 text-right text-xs {project.description.length < DESC_MIN
							? 'text-red-500'
							: 'text-gray-500'}"
					>
						{project.description.length}/{DESC_MAX} (min {DESC_MIN})
					</p>
				</div>

				<!-- GitHub URL -->
				<div>
					<label for="githubUrl" class="mb-2 block text-sm font-bold"
						>github url <span class="text-red-500">*</span></label
					>
					<input
						id="githubUrl"
						type="url"
						bind:value={project.githubUrl}
						placeholder="https://github.com/user/repo"
						class="w-full rounded-lg border-2 border-black px-4 py-3 focus:border-dashed focus:outline-none"
					/>
				</div>

				<!-- Playable URL -->
				<div>
					<label for="playableUrl" class="mb-2 block text-sm font-bold"
						>playable url <span class="text-red-500">*</span></label
					>
					<input
						id="playableUrl"
						type="url"
						bind:value={project.playableUrl}
						placeholder="https://yourproject.com or https://replit.com/..."
						class="w-full rounded-lg border-2 border-black px-4 py-3 focus:border-dashed focus:outline-none"
					/>
					<p class="mt-1 text-xs text-gray-500">a link where reviewers can try your project</p>
				</div>

				<!-- Hackatime Project Dropdown -->
				<div>
					<label class="mb-2 block text-sm font-bold"
						>hackatime project <span class="text-red-500">*</span></label
					>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="flex w-full cursor-pointer items-center justify-between rounded-lg border-2 border-black px-4 py-3 text-left focus:border-dashed focus:outline-none"
						>
							{#if loadingProjects}
								<span class="text-gray-500">loading projects...</span>
							{:else if selectedHackatimeName}
								<span
									>{selectedHackatimeName}
									<span class="text-gray-500">({formatHours(project.hours)}h)</span></span
								>
							{:else}
								<span class="text-gray-500">select a project</span>
							{/if}
							<ChevronDown
								size={20}
								class={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'}
							/>
						</button>

						{#if showDropdown && !loadingProjects}
							<div
								class="absolute top-full right-0 left-0 z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border-2 border-black bg-white"
							>
								{#if hackatimeProjects.length === 0}
									<div class="px-4 py-2 text-sm text-gray-500">no projects found</div>
								{:else}
									{#each hackatimeProjects as hp}
										<button
											type="button"
											onclick={() => selectHackatimeProject(hp)}
											class="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-left hover:bg-gray-100"
										>
											<span class="font-medium">{hp.name}</span>
											<span class="text-sm text-gray-500">{formatHours(hp.hours)}h</span>
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
				<label class="mb-2 block text-sm font-bold"
					>project tier <span class="text-red-500">*</span></label
				>
				<p class="mb-3 text-xs text-gray-500">
					select the complexity tier that best matches your project
				</p>
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{#each TIERS as tier}
						<button
							type="button"
							onclick={() => (selectedTier = tier.value)}
							class="cursor-pointer rounded-full border-4 border-black px-4 py-3 text-left font-bold transition-all duration-200 {selectedTier ===
							tier.value
								? 'bg-black text-white'
								: 'hover:border-dashed'}"
						>
							<div class="flex items-center justify-between">
								<span>tier {tier.value}</span>
							</div>
							<p
								class="mt-1 text-xs {selectedTier === tier.value
									? 'text-gray-300'
									: 'text-gray-500'}"
							>
								{tier.description}
							</p>
						</button>
					{/each}
				</div>
			</div>

			<!-- Requirements Checklist -->
			<div class="mb-6 rounded-lg border-2 border-black p-4">
				<p class="mb-3 font-bold">requirements checklist</p>
				<ul class="space-y-2">
					<li class="flex items-center gap-2 text-sm">
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black {hasImage
								? 'bg-black text-white'
								: ''}"
						>
							{#if hasImage}<Check size={12} />{/if}
						</span>
						<span class={hasImage ? '' : 'text-gray-500'}>project image uploaded</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black {hasName
								? 'bg-black text-white'
								: ''}"
						>
							{#if hasName}<Check size={12} />{/if}
						</span>
						<span class={hasName ? '' : 'text-gray-500'}>project name (max {NAME_MAX} chars)</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black {hasDescription
								? 'bg-black text-white'
								: ''}"
						>
							{#if hasDescription}<Check size={12} />{/if}
						</span>
						<span class={hasDescription ? '' : 'text-gray-500'}
							>description ({DESC_MIN}-{DESC_MAX} chars)</span
						>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black {hasGithub
								? 'bg-black text-white'
								: ''}"
						>
							{#if hasGithub}<Check size={12} />{/if}
						</span>
						<span class={hasGithub ? '' : 'text-gray-500'}>github repository linked</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black {hasPlayableUrl
								? 'bg-black text-white'
								: ''}"
						>
							{#if hasPlayableUrl}<Check size={12} />{/if}
						</span>
						<span class={hasPlayableUrl ? '' : 'text-gray-500'}>playable url provided</span>
					</li>
					<li class="flex items-center gap-2 text-sm">
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-black {hasHackatime
								? 'bg-black text-white'
								: ''}"
						>
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
					class="flex-1 cursor-pointer rounded-full border-4 border-black px-4 py-3 text-center font-bold transition-all duration-200 hover:border-dashed"
				>
					cancel
				</a>
				<button
					onclick={handleSubmit}
					disabled={submitting || !allRequirementsMet}
					class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-black px-4 py-3 font-bold text-white transition-all duration-200 hover:bg-gray-800 disabled:opacity-50"
				>
					<Send size={18} />
					{submitting ? 'submitting...' : 'submit for review'}
				</button>
			</div>
		</div>
	{/if}
</div>
