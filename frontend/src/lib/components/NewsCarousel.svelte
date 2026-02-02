<script lang="ts">
	import { onMount } from 'svelte'
	import { ChevronLeft, ChevronRight } from '@lucide/svelte'
	import { newsStore, newsLoading, fetchNews } from '$lib/stores'

	let currentIndex = $state(0)
	let isPaused = $state(false)

	const AUTO_SCROLL_INTERVAL = 5000

	onMount(() => {
		fetchNews()

		const interval = setInterval(() => {
			if (!isPaused && $newsStore.length > 1) {
				currentIndex = (currentIndex + 1) % $newsStore.length
			}
		}, AUTO_SCROLL_INTERVAL)

		return () => clearInterval(interval)
	})

	function goTo(index: number) {
		currentIndex = index
	}

	function prev() {
		currentIndex = currentIndex === 0 ? $newsStore.length - 1 : currentIndex - 1
	}

	function next() {
		currentIndex = (currentIndex + 1) % $newsStore.length
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}
</script>

{#if !$newsLoading && $newsStore.length > 0}
	<div
		class="border-4 border-black rounded-2xl p-6 mb-8 relative overflow-hidden"
		onmouseenter={() => (isPaused = true)}
		onmouseleave={() => (isPaused = false)}
		role="region"
		aria-label="News carousel"
	>
		<div class="flex items-center justify-between mb-2">
			<h2 class="font-bold text-lg">news</h2>
			{#if $newsStore.length > 1}
				<div class="flex items-center gap-2">
					<button
						onclick={prev}
						class="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
						aria-label="Previous news"
					>
						<ChevronLeft size={20} />
					</button>
					<button
						onclick={next}
						class="p-1 hover:bg-gray-100 rounded transition-colors cursor-pointer"
						aria-label="Next news"
					>
						<ChevronRight size={20} />
					</button>
				</div>
			{/if}
		</div>

		<div class="relative h-20 overflow-hidden">
			{#each $newsStore as item, index (item.id)}
				<div
					class="absolute inset-0 transition-all duration-500 ease-in-out {index === currentIndex
						? 'opacity-100 translate-x-0'
						: index < currentIndex
							? 'opacity-0 -translate-x-full'
							: 'opacity-0 translate-x-full'}"
				>
					<p class="text-xl font-bold mb-1">{item.title}</p>
					<p class="text-gray-600">{item.content}</p>
					<p class="text-sm text-gray-400 mt-1">{formatDate(item.createdAt)}</p>
				</div>
			{/each}
		</div>

		{#if $newsStore.length > 1}
			<div class="flex justify-center gap-2 mt-4">
				{#each $newsStore as _, index}
					<button
						onclick={() => goTo(index)}
						class="w-2 h-2 rounded-full transition-all duration-300 cursor-pointer {index === currentIndex
							? 'bg-black w-6'
							: 'bg-gray-300 hover:bg-gray-400'}"
						aria-label="Go to news {index + 1}"
					></button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
