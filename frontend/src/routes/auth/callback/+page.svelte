<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { getUser } from '$lib/auth-client';

	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			// Check URL for error from backend
			const urlParams = new URLSearchParams(window.location.search);
			const authError = urlParams.get('error');

			if (authError === 'not-eligible') {
				goto('/auth/error?reason=not-eligible');
				return;
			}

			// Check if we have a session now
			const user = await getUser();
			if (user) {
				goto('/dashboard');
			} else {
				error = 'Authentication failed';
			}
		} catch (e) {
			console.error('Auth callback error:', e);
			error = 'An error occurred during authentication';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>authenticating... - scraps</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center">
	{#if loading}
		<div class="text-center">
			<h1 class="mb-4 text-4xl font-bold">authenticating...</h1>
			<p class="text-gray-600">please wait while we verify your account</p>
		</div>
	{:else if error}
		<div class="text-center">
			<h1 class="mb-4 text-4xl font-bold text-red-600">oops!</h1>
			<p class="mb-6 text-gray-600">{error}</p>
			<a
				href="/"
				class="cursor-pointer rounded-full border-4 border-black px-6 py-2 font-bold transition-all hover:border-dashed"
			>
				go back home
			</a>
		</div>
	{/if}
</div>
