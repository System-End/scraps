<script lang="ts">
	import { LogIn } from '@lucide/svelte';
</script>

<nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:w-3/4 md:mx-auto md:left-1/2 md:-translate-x-1/2">
	<a href="/">
		<img src="/flag-standalone-bw.png" alt="Hack Club" class="h-8 md:h-10" />
	</a>

	<a
		href="https://forms.hackclub.com/t/58ZE2tdz5bus"
		target="_blank"
		rel="noopener noreferrer"
		class="nav-button group flex items-center gap-2 px-6 py-2 border-4 border-black rounded-full transition-all duration-300 hover:border-dashed"
	>
		<LogIn size={18} />
		<span class="text-lg font-bold">submit</span>
	</a>
</nav>
