<script lang="ts">
	import './layout.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.ico';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Tutorial from '$lib/components/Tutorial.svelte';
	import ErrorModal from '$lib/components/ErrorModal.svelte';
	import { handleNavigation, prefetchUserData } from '$lib/stores';
	import { getUser, type User } from '$lib/auth-client';

	let { children } = $props();

	let previousPath = $state('');
	let showTutorial = $state(false);
	let user = $state<User | null>(null);

	// Handle navigation changes
	$effect(() => {
		const currentPath = $page.url.pathname;
		if (currentPath !== previousPath) {
			handleNavigation(currentPath);
			previousPath = currentPath;
		}
	});

	let hideNavbar = $derived($page.url.pathname.startsWith('/auth/error'));

	// Prefetch data on initial load if user is logged in
	onMount(async () => {
		user = await getUser();
		if (user) {
			prefetchUserData();
			// Show tutorial for users who haven't completed it
			if (!user.tutorialCompleted) {
				showTutorial = true;
			}
		}
	});

	function handleTutorialComplete() {
		showTutorial = false;
	}
</script>

<svelte:head
	><link rel="icon" href={favicon} />
	<title>scraps</title>
	<meta name="description" content="a ysws where you get scraps from hack club hq" />
</svelte:head>

<div class="flex min-h-dvh flex-col">
	{#if !hideNavbar}
		<Navbar />
	{/if}
	<main class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>

{#if showTutorial}
	<Tutorial onComplete={handleTutorialComplete} />
{/if}

<ErrorModal />
