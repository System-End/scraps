<script lang="ts">
	import { Heart } from '@lucide/svelte'

	let {
		count = 0,
		hearted = false,
		onclick
	}: {
		count: number
		hearted: boolean
		onclick: () => void
	} = $props()
</script>

<button
	{onclick}
	class="flex items-center gap-1 p-2 rounded-full border-2 border-black transition-colors cursor-pointer {hearted
		? 'bg-red-100 border-red-500'
		: 'hover:bg-gray-100'}"
	title={hearted ? 'Remove from wishlist' : 'Add to wishlist'}
>
	<Heart size={16} class={hearted ? 'fill-red-500 text-red-500' : ''} />
	{#if count > 0}
		<span class="text-xs font-bold">{count}</span>
	{/if}
</button>
