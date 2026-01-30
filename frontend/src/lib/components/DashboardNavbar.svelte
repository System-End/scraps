<script lang="ts">
	import { page } from '$app/state'
	import { LayoutDashboard, Trophy, Store, Flame, Send, Spool } from '@lucide/svelte'

	let { screws = 0 }: { screws?: number } = $props()

	let currentPath = $derived(page.url.pathname)
</script>

<nav
	class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-sm"
>
	<a href="/">
		<img src="/flag-standalone-bw.png" alt="Hack Club" class="h-8 md:h-10" />
	</a>

	<div class="flex items-center gap-2">
		<a
			href="/dashboard"
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {currentPath ===
			'/dashboard'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<LayoutDashboard size={18} />
			<span class="text-lg font-bold">dashboard</span>
		</a>

		<a
			href="/leaderboard"
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {currentPath ===
			'/leaderboard'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<Trophy size={18} />
			<span class="text-lg font-bold">leaderboard</span>
		</a>

		<a
			href="/shop"
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {currentPath ===
			'/shop'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<Store size={18} />
			<span class="text-lg font-bold">shop</span>
		</a>

		<a
			href="/refinery"
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {currentPath ===
			'/refinery'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<Flame size={18} />
			<span class="text-lg font-bold">refinery</span>
		</a>

		<a
			href="https://forms.hackclub.com/t/58ZE2tdz5bus"
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-2 px-6 py-2 border-4 border-black rounded-full transition-all duration-300 hover:border-dashed"
		>
			<Send size={18} />
			<span class="text-lg font-bold">submit</span>
		</a>
	</div>

	<div class="flex items-center gap-2 px-6 py-2 border-4 border-black rounded-full">
		<Spool size={20} />
		<span class="text-lg font-bold">{screws}</span>
	</div>
</nav>
