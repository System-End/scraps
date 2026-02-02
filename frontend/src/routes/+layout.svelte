<script lang="ts">
	import './layout.css'
	import { page } from '$app/stores'
	import { onMount } from 'svelte'
	import favicon from '$lib/assets/favicon.ico'
	import Navbar from '$lib/components/Navbar.svelte'
	import Footer from '$lib/components/Footer.svelte'
	import { handleNavigation, prefetchUserData } from '$lib/stores'
	import { getUser } from '$lib/auth-client'

	let { children } = $props()

	let previousPath = $state('')

	// Handle navigation changes
	$effect(() => {
		const currentPath = $page.url.pathname
		if (currentPath !== previousPath) {
			handleNavigation(currentPath)
			previousPath = currentPath
		}
	})

	// Prefetch data on initial load if user is logged in
	onMount(async () => {
		const user = await getUser()
		if (user) {
			prefetchUserData()
		}
	})
</script>

<svelte:head><link rel="icon" href={favicon} />
<title>scraps</title>
<meta name="description" content="a ysws where you get scraps from hack club hq" />
</svelte:head>

<div class="min-h-dvh flex flex-col">
	<Navbar />
	<main class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>
