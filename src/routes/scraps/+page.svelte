<script lang="ts">
	import { onMount } from 'svelte';

	interface ScrapItem {
		id: string;
		image: string;
		title: string;
		chance: number;
		description?: string;
	}

	const exampleItems: ScrapItem[] = [
		{ id: '1', image: '/hero.png', title: 'esp32', chance: 15, description: 'a tiny microcontroller' },
		{ id: '2', image: '/hero.png', title: 'arduino nano', chance: 10 },
		{ id: '3', image: '/hero.png', title: 'breadboard', chance: 20, description: 'for prototyping' },
		{ id: '4', image: '/hero.png', title: 'resistor pack', chance: 25 },
		{ id: '5', image: '/hero.png', title: 'vermont fudge', chance: 5, description: 'delicious!' },
		{ id: '6', image: '/hero.png', title: 'rare sticker', chance: 8 },
		{ id: '7', image: '/hero.png', title: 'postcard', chance: 12 },
		{ id: '8', image: '/hero.png', title: 'sensor kit', chance: 5, description: 'various sensors' }
	];

	let row1ScrollPos = $state(0);
	let row2ScrollPos = $state(0);
	let isManualScrolling = $state(false);
	let manualScrollTimeout: ReturnType<typeof setTimeout>;

	const SCROLL_SPEED = 0.5;
	const ITEM_WIDTH = 280;
	const GAP = 16;

	function duplicateItems(items: ScrapItem[], times: number): ScrapItem[] {
		const result: ScrapItem[] = [];
		for (let i = 0; i < times; i++) {
			items.forEach((item, idx) => {
				result.push({ ...item, id: `${item.id}-${i}-${idx}` });
			});
		}
		return result;
	}

	const row1Items = duplicateItems(exampleItems, 8);
	const row2Items = duplicateItems([...exampleItems].reverse(), 8);

	const totalSetWidth = exampleItems.length * (ITEM_WIDTH + GAP);

	onMount(() => {
		let animationId: number;

		function animate() {
			if (!isManualScrolling) {
				row1ScrollPos += SCROLL_SPEED;
				row2ScrollPos += SCROLL_SPEED;

				if (row1ScrollPos >= totalSetWidth) {
					row1ScrollPos = row1ScrollPos - totalSetWidth;
				}
				if (row2ScrollPos >= totalSetWidth) {
					row2ScrollPos = row2ScrollPos - totalSetWidth;
				}
			}
			animationId = requestAnimationFrame(animate);
		}

		animate();

		return () => {
			cancelAnimationFrame(animationId);
		};
	});

	function handleWheel(e: WheelEvent, row: 1 | 2) {
		if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			e.preventDefault();
			isManualScrolling = true;

			if (row === 1) {
				row1ScrollPos += e.deltaX;
				if (row1ScrollPos < 0) row1ScrollPos += totalSetWidth;
				if (row1ScrollPos >= totalSetWidth) row1ScrollPos -= totalSetWidth;
			} else {
				row2ScrollPos -= e.deltaX;
				if (row2ScrollPos < 0) row2ScrollPos += totalSetWidth;
				if (row2ScrollPos >= totalSetWidth) row2ScrollPos -= totalSetWidth;
			}

			clearTimeout(manualScrollTimeout);
			manualScrollTimeout = setTimeout(() => {
				isManualScrolling = false;
			}, 1000);
		}
	}
</script>

<div class="h-[calc(100dvh-80px)] flex flex-col overflow-hidden">
	<div class="px-6 md:px-12 pt-24 pb-8">
		<div class="max-w-3xl mx-auto">
			<h1 class="text-4xl md:text-6xl font-bold mb-2">scraps</h1>
			<p class="text-lg md:text-xl text-gray-600">(items up for grabs)</p>
		</div>
	</div>

	<div class="flex-1 flex flex-col justify-center w-screen overflow-hidden">
		<!-- Row 1 - scrolling right, tilted up -->
		<div
			class="relative mb-8"
			style="transform: rotate(-3deg); margin-left: -100px; margin-right: -100px;"
		>
			<div
				class="flex gap-4 cursor-grab active:cursor-grabbing"
				style="transform: translateX({-row1ScrollPos}px);"
				onwheel={(e) => handleWheel(e, 1)}
				role="list"
			>
				{#each row1Items as item (item.id)}
					<div
						class="flex-shrink-0 w-[260px] p-4 bg-white border-2 border-dashed border-black rounded-lg transition-all duration-300 hover:border-solid"
						role="listitem"
					>
						<img src={item.image} alt={item.title} class="w-full h-32 object-contain mb-3" />
						<h3 class="font-bold text-lg">{item.title}</h3>
						<p class="text-sm text-gray-600">{item.chance}% chance</p>
						{#if item.description}
							<p class="text-sm mt-1">{item.description}</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Row 2 - scrolling left, tilted down -->
		<div
			class="relative"
			style="transform: rotate(3deg); margin-left: -100px; margin-right: -100px;"
		>
			<div
				class="flex gap-4 cursor-grab active:cursor-grabbing"
				style="transform: translateX({row2ScrollPos - totalSetWidth}px);"
				onwheel={(e) => handleWheel(e, 2)}
				role="list"
			>
				{#each row2Items as item (item.id)}
					<div
						class="flex-shrink-0 w-[260px] p-4 bg-white border-2 border-dashed border-black rounded-lg transition-all duration-300 hover:border-solid"
						role="listitem"
					>
						<img src={item.image} alt={item.title} class="w-full h-32 object-contain mb-3" />
						<h3 class="font-bold text-lg">{item.title}</h3>
						<p class="text-sm text-gray-600">{item.chance}% chance</p>
						{#if item.description}
							<p class="text-sm mt-1">{item.description}</p>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
