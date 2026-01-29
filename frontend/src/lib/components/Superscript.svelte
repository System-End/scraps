<script lang="ts">
	let { number, tooltip }: { number: number | string; tooltip: string } = $props();
</script>

<span class="relative group">
	<sup class="cursor-help hover:underline">{number}</sup>
	<span
		class="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-sm bg-white border-2 border-dashed border-black rounded whitespace-nowrap z-10"
	>
		{tooltip}
	</span>
</span>
