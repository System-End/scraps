<script lang="ts">
	import { page } from '$app/state'
	import { onMount } from 'svelte'
	import {
		Home,
		Package,
		Info,
		LayoutDashboard,
		Trophy,
		Store,
		Flame,
		Spool,
		LogOut,
		Shield
	} from '@lucide/svelte'
	import { logout, getUser } from '$lib/auth-client'

	interface User {
		id: number
		username: string
		email: string
		avatar: string | null
		slackId: string | null
		scraps: number
		role?: string
	}

	let user = $state<User | null>(null)
	let showProfileMenu = $state(false)
	let activeSection = $state('home')
	let isScrolling = $state(false)

	let currentPath = $derived(page.url.pathname)
	let isHomePage = $derived(currentPath === '/')
	let isLoggedIn = $derived(user !== null)
	let isAdmin = $derived(user?.role === 'admin' || user?.role === 'reviewer')
	let isInAdminSection = $derived(currentPath.startsWith('/admin'))
	let screws = $derived(user?.scraps ?? 0)

	let observer: IntersectionObserver | null = null

	onMount(() => {
		getUser().then((u) => {
			user = u
		})

		if (page.url.pathname === '/') {
			const sections = ['home', 'scraps', 'about']
			observer = new IntersectionObserver(
				(entries) => {
					if (isScrolling) return
					entries.forEach((entry) => {
						if (entry.isIntersecting && entry.intersectionRatio > 0.3) {
							activeSection = entry.target.id
						}
					})
				},
				{
					threshold: [0.3, 0.5, 0.7],
					rootMargin: '-20% 0px -20% 0px'
				}
			)

			sections.forEach((id) => {
				const element = document.getElementById(id)
				if (element && observer) observer.observe(element)
			})
		}

		return () => {
			if (observer) observer.disconnect()
		}
	})

	function scrollToSection(sectionId: string) {
		isScrolling = true
		activeSection = sectionId
		if (sectionId === 'home') {
			window.scrollTo({ top: 0, behavior: 'smooth' })
		} else {
			const element = document.getElementById(sectionId)
			if (element) element.scrollIntoView({ behavior: 'smooth' })
		}
		setTimeout(() => {
			isScrolling = false
		}, 1000)
	}

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

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement
		if (!target.closest('.profile-menu-container')) {
			closeProfileMenu()
		}
	}}
/>

<nav
	class="fixed top-0 left-0 right-0 z-50 flex items-right px-6 py-4 md:px-12 lg:px-64 bg-white/90 backdrop-blur-sm {isHomePage && !isLoggedIn ? 'justify-between' : ''}"
>
	<a href="/" class="shrink-0">
		<img src="/flag-standalone-bw.png" alt="Hack Club" class="h-8 md:h-10" />
	</a>

	{#if isHomePage && !isLoggedIn}
		<!-- Landing page nav for non-logged-in users - right aligned -->
		<div class="flex items-center gap-2">
			<button
				onclick={() => scrollToSection('home')}
				class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeSection ===
				'home'
					? 'bg-black text-white border-black'
					: 'border-black hover:border-dashed'}"
			>
				<Home size={18} />
				<span class="text-lg font-bold">home</span>
			</button>
			<button
				onclick={() => scrollToSection('scraps')}
				class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeSection ===
				'scraps'
					? 'bg-black text-white border-black'
					: 'border-black hover:border-dashed'}"
			>
				<Package size={18} />
				<span class="text-lg font-bold">scraps</span>
			</button>
			<button
				onclick={() => scrollToSection('about')}
				class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeSection ===
				'about'
					? 'bg-black text-white border-black'
					: 'border-black hover:border-dashed'}"
			>
				<Info size={18} />
				<span class="text-lg font-bold">about</span>
			</button>
		</div>
	{:else}
		<!-- Dashboard nav for logged-in users - centered -->
		<div class="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
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
		</div>
	{/if}

	<!-- Right side -->
	{#if isLoggedIn}
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
							<img
								src={user.avatar}
								alt={user.username || 'Profile'}
								class="w-full h-full object-cover"
							/>
						{:else}
							<div
								class="w-full h-full bg-black text-white flex items-center justify-center font-bold text-lg"
							>
								{(user.username || user.email || '?').charAt(0).toUpperCase()}
							</div>
						{/if}
					</button>

					{#if showProfileMenu}
						<div
							class="absolute right-0 top-14 bg-white border-4 border-black rounded-2xl overflow-hidden min-w-48 z-50"
						>
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
	{:else}
	{/if}
</nav>

{#if isAdmin}
	<a
		href={isInAdminSection ? '/dashboard' : '/admin/reviews'}
		class="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-all duration-200 border-4 border-red-800"
	>
		<Shield size={20} />
		<span>{isInAdminSection ? 'escape' : 'admin'}</span>
	</a>
{/if}
