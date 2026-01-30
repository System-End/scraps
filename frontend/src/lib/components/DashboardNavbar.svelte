<script lang="ts">
	import { page } from '$app/state'
	import { LayoutDashboard, Trophy, Store, Flame, Send, Spool, LogOut } from '@lucide/svelte'
	import { logout } from '$lib/auth-client'

	interface User {
		id: number
		username: string
		email: string
		avatar: string | null
		slackId: string | null
	}

	let { screws = 0, user = null }: { screws?: number; user?: User | null } = $props()

	let currentPath = $derived(page.url.pathname)
	let showProfileMenu = $state(false)

	function handleLogout() {
		logout()
	}

	function toggleProfileMenu() {
		showProfileMenu = !showProfileMenu
	}

	function closeProfileMenu() {
		showProfileMenu = false
	}
</script>

<svelte:window onclick={(e) => {
	const target = e.target as HTMLElement
	if (!target.closest('.profile-menu-container')) {
		closeProfileMenu()
	}
}} />

<nav
	class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 lg:px-24 bg-white/90 backdrop-blur-sm"
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

	<div class="flex items-center gap-4">
		<div class="flex items-center gap-2 px-6 py-2 border-4 border-black rounded-full">
			<Spool size={20} />
			<span class="text-lg font-bold">{screws}</span>
		</div>

		{#if user}
			<div class="relative profile-menu-container">
				<button
					onclick={toggleProfileMenu}
					class="w-10 h-10 rounded-full border-4 border-black overflow-hidden hover:border-dashed transition-all duration-200"
				>
					{#if user.avatar}
						<img src={user.avatar} alt={user.username || 'Profile'} class="w-full h-full object-cover" />
					{:else}
						<div class="w-full h-full bg-black text-white flex items-center justify-center font-bold text-lg">
							{(user.username || user.email || '?').charAt(0).toUpperCase()}
						</div>
					{/if}
				</button>

				{#if showProfileMenu}
					<div class="absolute right-0 top-14 bg-white border-4 border-black rounded-2xl overflow-hidden min-w-48 z-50">
						<div class="px-4 py-3 border-b-2 border-black">
							<p class="font-bold truncate">{user.username || 'user'}</p>
							<p class="text-sm text-gray-500 truncate">{user.email}</p>
						</div>
						<button
							onclick={handleLogout}
							class="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-100 transition-colors text-left"
						>
							<LogOut size={18} />
							<span class="font-bold">logout</span>
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</nav>
