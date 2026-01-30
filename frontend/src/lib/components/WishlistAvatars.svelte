<script lang="ts">
	import { Heart } from '@lucide/svelte'

	interface WishlistUser {
		id: number
		name: string
		avatar: string
	}

	let {
		users = [],
		onWishlist
	}: {
		users: WishlistUser[]
		onWishlist: () => void
	} = $props()

	let expanded = $state(false)
	let containerRef = $state<HTMLDivElement | null>(null)

	function toggleExpand() {
		expanded = !expanded
	}

	function handleClickOutside(e: MouseEvent) {
		if (containerRef && !containerRef.contains(e.target as Node)) {
			expanded = false
		}
	}

	$effect(() => {
		if (expanded) {
			document.addEventListener('click', handleClickOutside)
			return () => document.removeEventListener('click', handleClickOutside)
		}
	})

	const maxVisible = 3
	const visibleUsers = $derived(users.slice(0, maxVisible))
	const remainingCount = $derived(Math.max(0, users.length - maxVisible))
</script>

<div class="relative" bind:this={containerRef}>
	<div class="flex items-center gap-2">
		<!-- Wishlist button -->
		<button
			onclick={onWishlist}
			class="p-2 rounded-full border-2 border-black hover:bg-gray-100 transition-colors"
			title="Add to wishlist"
		>
			<Heart size={16} />
		</button>

		<!-- Stacked avatars -->
		{#if users.length > 0}
			<button
				onclick={toggleExpand}
				class="flex items-center -space-x-2 cursor-pointer"
			>
				{#each visibleUsers as user, i}
					<img
						src={user.avatar}
						alt={user.name}
						class="w-8 h-8 rounded-full border-2 border-white object-cover transition-transform hover:scale-110"
						style="z-index: {maxVisible - i}"
					/>
				{/each}
				{#if remainingCount > 0}
					<div
						class="w-8 h-8 rounded-full border-2 border-white bg-black text-white flex items-center justify-center text-xs font-bold"
						style="z-index: 0"
					>
						+{remainingCount}
					</div>
				{/if}
			</button>
		{/if}
	</div>

	<!-- Expanded quarter circle menu -->
	{#if expanded && users.length > 0}
		<div
			class="absolute bottom-full right-0 mb-2 origin-bottom-right"
		>
			<div
				class="relative w-48 h-48 overflow-hidden"
			>
				<div
					class="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-white border-4 border-black overflow-hidden"
					style="transform: translate(50%, 50%)"
				>
					<div
						class="absolute top-0 left-0 w-48 h-48 overflow-y-auto p-4 scrollbar-hide"
					>
						<div class="space-y-2">
							{#each users as user (user.id)}
								<div class="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors">
									<img
										src={user.avatar}
										alt={user.name}
										class="w-10 h-10 rounded-full object-cover border-2 border-black"
									/>
									<span class="font-bold text-sm truncate">{user.name}</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
