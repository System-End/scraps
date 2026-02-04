<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Send } from '@lucide/svelte';
	import ProjectPlaceholder from '$lib/components/ProjectPlaceholder.svelte';
	import { getUser } from '$lib/auth-client';
	import { API_URL } from '$lib/config';
	import { formatHours } from '$lib/utils';

	interface Review {
		id: number;
		action: string;
		feedbackForAuthor: string;
		createdAt: string;
	}

	interface Project {
		id: number;
		name: string;
		description: string;
		image: string | null;
		githubUrl: string | null;
		status: string;
		hours: number;
	}

	interface User {
		id: number;
		username: string;
		email: string;
		avatar: string | null;
		slackId: string | null;
		scraps: number;
		role: string;
	}

	let user = $state<User | null>(null);
	let project = $state<Project | null>(null);
	let reviews = $state<Review[]>([]);
	let loading = $state(true);
	let submitting = $state(false);
	let error = $state<string | null>(null);
	let scraps = $derived(user?.scraps ?? 0);

	let projectId = $derived(page.params.id);

	onMount(async () => {
		user = await getUser();
		if (!user) {
			goto('/');
			return;
		}

		try {
			const [projectRes, reviewsRes] = await Promise.all([
				fetch(`${API_URL}/projects/${projectId}`, { credentials: 'include' }),
				fetch(`${API_URL}/projects/${projectId}/reviews`, { credentials: 'include' })
			]);

			if (projectRes.ok) {
				const data = await projectRes.json();
				if (!data.error) project = data;
			}

			if (reviewsRes.ok) {
				const data = await reviewsRes.json();
				if (Array.isArray(data)) reviews = data;
			}
		} catch (e) {
			console.error('Failed to fetch project:', e);
		} finally {
			loading = false;
		}
	});

	async function submitProject() {
		if (!project) return;

		submitting = true;
		error = null;

		try {
			const response = await fetch(`${API_URL}/projects/${project.id}/submit`, {
				method: 'POST',
				credentials: 'include'
			});

			const data = await response.json();
			if (data.error) {
				throw new Error(data.error);
			}

			project = data;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to submit project';
		} finally {
			submitting = false;
		}
	}

	function getStatusLabel(status: string) {
		const labels: Record<string, string> = {
			in_progress: 'in progress',
			waiting_for_review: 'waiting for review',
			shipped: 'shipped',
			permanently_rejected: 'rejected'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: string) {
		const colors: Record<string, string> = {
			in_progress: 'bg-yellow-100',
			waiting_for_review: 'bg-blue-100',
			shipped: 'bg-green-100',
			permanently_rejected: 'bg-red-100'
		};
		return colors[status] || 'bg-gray-100';
	}
</script>

<svelte:head>
	<title>{project?.name || 'project'} - scraps</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 pt-24 pb-24 md:px-12">
	{#if loading}
		<div class="py-12 text-center text-gray-500">loading...</div>
	{:else if !project}
		<div class="py-12 text-center text-gray-500">project not found</div>
	{:else}
		<!-- Project Image -->
		<div class="mb-8 h-64 w-full overflow-hidden rounded-2xl border-4 border-black md:h-96">
			{#if project.image}
				<img src={project.image} alt={project.name} class="h-full w-full object-cover" />
			{:else}
				<ProjectPlaceholder seed={project.id} />
			{/if}
		</div>

		<!-- Project Info -->
		<div class="mb-8">
			<div class="mb-4 flex items-start justify-between">
				<h1 class="text-4xl font-bold md:text-5xl">{project.name}</h1>
				<span class="rounded-full px-4 py-2 text-sm font-bold {getStatusColor(project.status)}">
					{getStatusLabel(project.status)}
				</span>
			</div>
			<p class="mb-4 text-lg text-gray-600">{project.description}</p>
			<div class="flex items-center gap-4">
				<span class="rounded-full px-3 py-1 text-sm font-bold"
					>{formatHours(project.hours)}h logged</span
				>
				{#if project.githubUrl}
					<a
						href={project.githubUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="cursor-pointer rounded-full px-3 py-1 text-sm font-bold transition-colors hover:bg-gray-200"
					>
						github
					</a>
				{/if}
			</div>
		</div>

		{#if error}
			<div class="mb-6 rounded-lg border-2 border-red-500 bg-red-100 p-4 text-red-700">
				{error}
			</div>
		{/if}

		<!-- Submit Button -->
		{#if project.status === 'in_progress'}
			<button
				onclick={submitProject}
				disabled={submitting}
				class="mb-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-black px-6 py-4 text-lg font-bold text-white transition-all duration-200 hover:bg-gray-800 disabled:opacity-50"
			>
				<Send size={20} />
				<span>{submitting ? 'submitting...' : 'submit for review'}</span>
			</button>
		{/if}

		<!-- Previous Reviews -->
		{#if reviews.length > 0}
			<div>
				<h2 class="mb-4 text-2xl font-bold">review feedback</h2>
				<div class="space-y-4">
					{#each reviews as review}
						<div class="rounded-2xl border-4 border-black p-6">
							<div class="mb-2 flex items-center justify-between">
								<span
									class="rounded-full px-3 py-1 text-sm font-bold {review.action === 'approved'
										? 'bg-green-100'
										: review.action === 'denied'
											? 'bg-yellow-100'
											: 'bg-red-100'}"
								>
									{review.action}
								</span>
								<span class="text-sm text-gray-500">
									{new Date(review.createdAt).toLocaleDateString()}
								</span>
							</div>
							<p class="text-gray-700">{review.feedbackForAuthor}</p>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
