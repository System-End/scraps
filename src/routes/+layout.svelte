<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();
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
