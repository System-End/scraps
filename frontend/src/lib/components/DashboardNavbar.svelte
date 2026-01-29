<script lang="ts">
	import { LayoutDashboard, Trophy, Store, Nut } from '@lucide/svelte'

	let { screws = 0 }: { screws?: number } = $props()

	let activeTab = $state('dashboard')
</script>

<nav
	class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:w-3/4 md:mx-auto md:left-1/2 md:-translate-x-1/2"
>
	<a href="/">
		<img src="/flag-standalone-bw.png" alt="Hack Club" class="h-8 md:h-10" />
	</a>

	<div class="flex items-center gap-2">
		<button
			onclick={() => (activeTab = 'dashboard')}
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeTab ===
			'dashboard'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<LayoutDashboard size={18} />
			<span class="text-lg font-bold">dashboard</span>
		</button>

		<button
			onclick={() => (activeTab = 'leaderboard')}
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeTab ===
			'leaderboard'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<Trophy size={18} />
			<span class="text-lg font-bold">leaderboard</span>
		</button>

		<button
			onclick={() => (activeTab = 'shop')}
			class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeTab ===
			'shop'
				? 'bg-black text-white border-black'
				: 'border-black hover:border-dashed'}"
		>
			<Store size={18} />
			<span class="text-lg font-bold">shop</span>
		</button>
	</div>

	<div class="flex items-center gap-2">
		<Nut size={24} />
		<span class="text-xl font-bold">{screws}</span>
	</div>
</nav>
