<script lang="ts">
	import { page } from '$app/stores';
	import { CircleHelp, Trash2, LogIn, Menu, X, CircleQuestionMark, Origami, Recycle, Home } from '@lucide/svelte';

	let isOpen = $state(false);

	const navItems = [
		{ href: '/', label: 'home', external: false, icon: Home },
		{ href: '/about', label: 'about', external: false, icon: Origami },
		{ href: '/scraps', label: 'scraps', external: false, icon: Recycle },
		{ href: 'https://google.com', label: 'submit', external: true, icon: LogIn }
	];

	function toggleMenu() {
		isOpen = !isOpen;
	}
</script>

<nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:w-3/4 md:mx-auto md:left-1/2 md:-translate-x-1/2">
	<a href="https://hackclub.com" target="_blank" rel="noopener noreferrer">
		<img src="/flag-standalone-bw.png" alt="Hack Club" class="h-8 md:h-10" />
	</a>

	<!-- Desktop nav -->
	<div class="hidden md:flex items-center gap-4">
		{#each navItems as item}
			{#if item.external}
				<a
					href={item.href}
					target="_blank"
					rel="noopener noreferrer"
					class="nav-button group flex items-center gap-2 px-6 py-2 border-4 border-black rounded-full transition-all duration-300 hover:border-dashed"
				>
					<item.icon size={18} />
					<span class="text-lg font-bold">{item.label}</span>
				</a>
			{:else}
				<a
					href={item.href}
					class="nav-button group flex items-center gap-2 px-6 py-2 border-4 border-black rounded-full transition-all duration-300 hover:border-dashed"
					class:border-dashed={$page.url.pathname === item.href}
				>
					<item.icon size={18} />
					<span class="text-lg font-bold">{item.label}</span>
				</a>
			{/if}
		{/each}
	</div>

	<!-- Mobile hamburger button -->
	<button onclick={toggleMenu} class="md:hidden z-50 p-2" aria-label="Toggle menu">
		{#if isOpen}
			<X size={32} class="transition-transform duration-300" />
		{:else}
			<Menu size={32} class="transition-transform duration-300" />
		{/if}
	</button>

	<!-- Mobile menu overlay -->
	<div
		class="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center transition-all duration-300 md:hidden"
		class:translate-x-0={isOpen}
		class:translate-x-full={!isOpen}
	>
		<div class="flex flex-col gap-6">
			{#each navItems as item}
				{#if item.external}
					<a
						href={item.href}
						target="_blank"
						rel="noopener noreferrer"
						onclick={() => (isOpen = false)}
						class="nav-button group flex items-center gap-2 px-8 py-3 border-4 border-black rounded-full transition-all duration-300 hover:border-dashed"
					>
						<item.icon size={24} />
						<span class="text-2xl font-bold">{item.label}</span>
					</a>
				{:else}
					<a
						href={item.href}
						onclick={() => (isOpen = false)}
						class="nav-button group flex items-center gap-2 px-8 py-3 border-4 border-black rounded-full transition-all duration-300 hover:border-dashed"
						class:border-dashed={$page.url.pathname === item.href}
					>
						<item.icon size={24} />
						<span class="text-2xl font-bold">{item.label}</span>
					</a>
				{/if}
			{/each}
		</div>
	</div>
</nav>
