<script lang="ts">
	import { CircleQuestionMark } from '@lucide/svelte';
	import Superscript from '$lib/components/Superscript.svelte';
</script>

<div class="h-dvh w-full overflow-hidden flex flex-col">
	<!-- Hero image - fullscreen on desktop -->
	<div class="w-full h-full md:h-full md:absolute md:inset-0 flex items-center justify-center">
		<img
			src="/hero.png"
			alt="Dino throwing paper"
			class="max-w-full h-auto max-h-[45vh] md:max-h-screen object-contain"
		/>
	</div>

	<!-- Content - absolute on desktop -->
	<div class="w-full px-6 py-4 md:absolute md:bottom-1/5 md:right-1/4 md:w-auto md:max-w-lg md:p-0">
		<h1 class="text-6xl md:text-8xl font-bold mb-4">scraps</h1>
		<p class="text-lg md:text-xl mb-1">
			<strong>ys:</strong> any project<Superscript number={1} tooltip="silly, nonsensical, or fun" />
		</p>
		<p class="text-lg md:text-xl mb-4">
			<strong>ws:</strong> a chance to win somthing amazing<Superscript number={2} tooltip="(including rare stickers)" />
		</p>

		<a
			href="/about"
			class="inline-flex items-center gap-2 px-6 py-2 border-4 border-dashed border-black rounded-full transition-all duration-300 hover:border-solid"
		>
			<CircleQuestionMark size={20} />
			<span class="font-bold">but how?</span>
		</a>
	</div>
</div>
