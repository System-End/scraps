<script lang="ts">
	import { onMount } from 'svelte'
	import { LogIn } from '@lucide/svelte'
	import Superscript from '$lib/components/Superscript.svelte'
	import { login } from '$lib/auth-client'

	let email = $state('')

	function handleLogin() {
		login()
	}

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

<!-- Hero Section -->
<div id="home" class="h-dvh w-full overflow-hidden flex flex-col">
	<div class="w-full h-full md:h-full md:absolute md:inset-0 flex items-center justify-center">
		<img
			src="/hero.png"
			alt="Dino throwing paper"
			class="max-w-full h-auto max-h-[45vh] md:max-h-screen object-contain"
		/>
	</div>

	<div class="w-full px-6 py-4 md:absolute md:bottom-1/5 md:right-1/4 md:w-auto md:max-w-lg md:p-0">
		<h1 class="text-6xl md:text-8xl font-bold mb-4">scraps</h1>
		<p class="text-lg md:text-xl mb-1">
			<strong>ys:</strong> any project<Superscript number={1} tooltip="silly, nonsensical, or fun" />
		</p>
		<p class="text-lg md:text-xl mb-6">
			<strong>ws:</strong> a chance to win somthing amazing<Superscript number={2} tooltip="(including rare stickers)" />
		</p>

		<!-- Auth Section -->
		<div class="flex flex-col sm:flex-row gap-3">
			<input
				type="email"
				bind:value={email}
				placeholder="your@email.com"
				class="flex-1 px-4 py-3 border-4 border-black rounded-full focus:outline-none focus:border-dashed"
			/>
			<button
				onclick={handleLogin}
				class="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all"
			>
				<LogIn size={18} />
				<span>sign up / login</span>
			</button>
		</div>
	</div>
</div>

<!-- Scraps Section -->
<div id="scraps" class="min-h-dvh flex flex-col overflow-hidden">
	<div class="px-6 md:px-12 pt-24 pb-8">
		<div class="max-w-3xl mx-auto">
			<h2 class="text-4xl md:text-6xl font-bold mb-2">scrapss</h2>
			<p class="text-lg md:text-xl text-gray-600">(items up for grabs)</p>
		</div>
	</div>

	<div class="flex-1 flex flex-col justify-center w-screen overflow-hidden pb-12">
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
						class="shrink-0 w-65 p-4 bg-white border-2 border-dashed border-black rounded-lg transition-all duration-300 hover:border-solid"
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
						class="shrink-0 w-65 p-4 bg-white border-2 border-dashed border-black rounded-lg transition-all duration-300 hover:border-solid"
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

<!-- About Section -->
<div id="about" class="min-h-dvh pt-24 px-6 md:px-12 max-w-3xl mx-auto pb-24">
	<h2 class="text-4xl md:text-6xl font-bold mb-8">about scraps</h2>

	<div class="prose prose-lg">
		<p class="text-xl font-bold mb-4">tl;dr</p>

		<p class="mb-2"><strong>ys:</strong> any project <Superscript number={3} tooltip="silly, nonsensical, or fun" /></p>

		<p class="mb-6">
			<strong>ws:</strong> random items from hq<Superscript number={4} tooltip="(including stickers)" /> (more hours, more stuff)
		</p>

		<p class="mb-6">
			it's cold and wintery here<Superscript number={5} tooltip="in vermont" /> at hack club hq. after prototype, overglade, milkyway, and other
			hackathons, there are boxes and boxes of items, "scraps," if you will. now, dear hack
			clubber, this ysws is your chance to win the cool leftovers, including random hardware<Superscript number={6} tooltip="sensors, esp32s, arduinos, breadboards, and a singular resistor" />,
			postcards, fudge, and maybe a secret surprise<Superscript number={7} tooltip="limited edition stickers" />!
		</p>

		<p class="text-xl font-bold mb-4">but how, you may ask?</p>

		<p class="mb-6">
			well, it's simple: you just ship any projects that are extra silly, nonsensical, or fun<Superscript number={8} tooltip="or literally any project" />, and
			you will get a chance to spin a wheel<Superscript number={9} tooltip="totally not gambling" /> for every 30 minutes of work you do!
		</p>

		<p class="text-xl font-bold mb-4">what's on the wheel?</p>

		<p class="mb-6">
			currently, there is a random assortment of hardware left over from prototype, postcards, the
			famous vermont fudge<Superscript number={10} tooltip="fudge fudge fudge" />, and more items planned as events wrap up. oh, and the best part,
			<strong>stickers!</strong>
		</p>

		<p class="mb-6">
			if you have ever wondered how to get the cool stickers from
			<a
				href="https://stickers.hackclub.com/"
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:no-underline"
			>
				stickers.hackclub.com</a
			>? well, here is your chance to get any sticker (that we have in stock) to complete your
			collection<Superscript number={11} tooltip="soon to be made collection.hackclub.com to keep track of your sticker collection" />! this includes some of the rarest and most sought-after stickers from hack club.
		</p>
	</div>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
