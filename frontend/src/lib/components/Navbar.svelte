<script lang="ts">
	import { onMount } from 'svelte'
	import { Home, Package, Info } from '@lucide/svelte'

	let activeSection = $state('home')
	let isScrolling = $state(false)

	function scrollToSection(sectionId: string) {
		isScrolling = true
		activeSection = sectionId
		if (sectionId === 'home') {
			window.scrollTo({ top: 0, behavior: 'smooth' })
		} else {
			const element = document.getElementById(sectionId)
			if (element) {
				element.scrollIntoView({ behavior: 'smooth' })
			}
		}
		setTimeout(() => {
			isScrolling = false
		}, 1000)
	}

	onMount(() => {
		const sections = ['home', 'scraps', 'about']

		const observer = new IntersectionObserver(
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
			if (element) {
				observer.observe(element)
			}
		})

		return () => {
			observer.disconnect()
		}
	})
</script>

<nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-6 py-4 bg-white/90 backdrop-blur-sm">
	<div class="w-full max-w-[75%] flex items-center justify-between">
		<a href="/">
			<img src="/flag-standalone-bw.png" alt="Hack Club" class="h-8 md:h-10" />
		</a>

		<div class="flex items-center gap-2">
			<button
				onclick={() => scrollToSection('home')}
				class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeSection === 'home'
					? 'bg-black text-white border-black'
					: 'border-black hover:border-dashed'}"
			>
				<Home size={18} />
				<span class="text-lg font-bold">home</span>
			</button>
			<button
				onclick={() => scrollToSection('scraps')}
				class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeSection === 'scraps'
					? 'bg-black text-white border-black'
					: 'border-black hover:border-dashed'}"
			>
				<Package size={18} />
				<span class="text-lg font-bold">scraps</span>
			</button>
			<button
				onclick={() => scrollToSection('about')}
				class="flex items-center gap-2 px-6 py-2 border-4 rounded-full transition-all duration-300 {activeSection === 'about'
					? 'bg-black text-white border-black'
					: 'border-black hover:border-dashed'}"
			>
				<Info size={18} />
				<span class="text-lg font-bold">about</span>
			</button>
		</div>
	</div>
</nav>
