<script lang="ts">
	import { onMount } from 'svelte'
	import { Origami } from '@lucide/svelte'
	import Superscript from '$lib/components/Superscript.svelte'
	import { login } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	let email = $state('')
	let emailError = $state('')
	let isSubmitting = $state(false)

	function isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
	}

	async function handleLogin() {
		emailError = ''

		if (!email.trim()) {
			emailError = 'please enter your email'
			return
		}

		if (!isValidEmail(email)) {
			emailError = 'please enter a valid email'
			return
		}

		isSubmitting = true
		try {
			await fetch(`${API_URL}/auth/collect-email`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			})
			login()
		} catch {
			login()
		}
	}

	interface ShopItem {
		id: number
		name: string
		description: string
		image: string
		price: number
		category: string
	}

	interface ScrapItem {
		id: string
		image: string
		title: string
		price: number
		description?: string
	}

	let shopItems = $state<ShopItem[]>([])
	let row1ScrollPos = $state(0)
	let row2ScrollPos = $state(0)
	let isManualScrolling = $state(false)
	let manualScrollTimeout: ReturnType<typeof setTimeout>

	const SCROLL_SPEED = 0.5
	const ITEM_WIDTH = 280
	const GAP = 16

	function shopToScrapItems(items: ShopItem[]): ScrapItem[] {
		return items.map((item) => ({
			id: String(item.id),
			image: item.image || '/hero.png',
			title: item.name,
			price: item.price,
			description: item.description
		}))
	}

	function duplicateItems(items: ScrapItem[], times: number): ScrapItem[] {
		const result: ScrapItem[] = []
		for (let i = 0; i < times; i++) {
			items.forEach((item, idx) => {
				result.push({ ...item, id: `${item.id}-${i}-${idx}` })
			})
		}
		return result
	}

	let scrapItems = $derived(shopToScrapItems(shopItems))
	let row1Items = $derived(duplicateItems(scrapItems, 8))
	let row2Items = $derived(duplicateItems([...scrapItems].reverse(), 8))
	let totalSetWidth = $derived(scrapItems.length * (ITEM_WIDTH + GAP))

	onMount(async () => {
		try {
			const response = await fetch(`${API_URL}/shop/items`)
			if (response.ok) {
				shopItems = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch shop items:', e)
		}

		let animationId: number

		function animate() {
			if (!isManualScrolling && totalSetWidth > 0) {
				row1ScrollPos += SCROLL_SPEED
				row2ScrollPos += SCROLL_SPEED

				if (row1ScrollPos >= totalSetWidth) {
					row1ScrollPos = row1ScrollPos - totalSetWidth
				}
				if (row2ScrollPos >= totalSetWidth) {
					row2ScrollPos = row2ScrollPos - totalSetWidth
				}
			}
			animationId = requestAnimationFrame(animate)
		}

		animate()

		return () => {
			cancelAnimationFrame(animationId)
		}
	})

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
		<div class="flex flex-col gap-2">
			<input
				type="email"
				bind:value={email}
				placeholder="your email"
				class="px-4 py-3 border-2 border-black rounded-full focus:outline-none focus:border-dashed w-full"
			/>
			{#if emailError}
				<p class="text-red-500 text-sm px-4">{emailError}</p>
			{/if}
			<button
				onclick={handleLogin}
				disabled={isSubmitting}
				class="flex items-center cursor-pointer justify-center gap-2 px-8 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
			>
				<Origami size={18} />
				<span>start scrapping</span>
			</button>
		</div>
	</div>
</div>

<!-- Scraps Section -->
<div id="scraps" class="min-h-dvh flex flex-col overflow-hidden">
	<div class="px-6 md:px-12 pt-24 pb-8">
		<div class="max-w-3xl mx-auto">
			<h2 class="text-4xl md:text-6xl font-bold mb-2">scraps</h2>
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
						class="shrink-0 w-65 p-4 bg-white border-4 border-dashed border-black rounded-lg transition-all duration-300 hover:border-solid"
						role="listitem"
					>
						<img src={item.image} alt={item.title} class="w-full h-32 object-contain mb-3" />
						<h3 class="font-bold text-lg">{item.title}</h3>
						<p class="text-sm text-gray-600">{item.price} scraps</p>
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
						class="shrink-0 w-65 p-4 bg-white border-4 border-dashed border-black rounded-lg transition-all duration-300 hover:border-solid"
						role="listitem"
					>
						<img src={item.image} alt={item.title} class="w-full h-32 object-contain mb-3" />
						<h3 class="font-bold text-lg">{item.title}</h3>
						<p class="text-sm text-gray-600">{item.price} scraps</p>
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

		<p class="mb-2"><strong>ys:</strong> any project <Superscript number={3} tooltip="optionally silly, nonsensical, or fun" /></p>

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
			well, it's simple: you just ship any projects that are slightly silly, nonsensical, or fun<Superscript number={8} tooltip="or literally any project" />, and
			you will earn scraps for the time you put in! track your time with <a
				href="https://hackatime.hackclub.com"
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:no-underline cursor-pointer"
			>hackatime</a> and watch the scraps roll in.
		</p>

		<p class="text-xl font-bold mb-4">what can you win?</p>

		<p class="mb-6">
			currently, there is a random assortment of hardware left over from prototype, postcards, the
			famous vermont fudge<Superscript number={9} tooltip="fudge fudge fudge" />, and more items planned as events wrap up. oh, and the best part,
			<strong>stickers!</strong>
		</p>

		<p class="mb-6">
			if you have ever wondered how to get the cool stickers from
			<a
				href="https://stickers.hackclub.com/"
				target="_blank"
				rel="noopener noreferrer"
				class="underline hover:no-underline cursor-pointer"
			>
				stickers.hackclub.com</a
			>? well, here is your chance to get any sticker (that we have in stock) to complete your
			collection<Superscript number={10} tooltip="soon to be made collection.hackclub.com to keep track of your sticker collection" />! this includes some of the rarest and most sought-after stickers from hack club.
		</p>

		<p class="text-xl font-bold mb-4">how does the shop work?</p>

		<p class="mb-6">
			here's where it gets interesting. each item in the shop has a <strong>base probability</strong> (like 50%). when you "try your luck," you spend scraps and roll the dice<Superscript number={11} tooltip="totally not gambling" />. if you roll under your probability, you win the item!
		</p>

		<p class="mb-6">
			but wait, there's more! you can visit <strong>the refinery</strong> to boost your odds. spend scraps to increase your probability for any item. the catch? each upgrade costs more than the last.
		</p>

		<p class="mb-6">
			so you have a choice: <strong>gamble at low odds</strong> and maybe get lucky, or <strong>invest in the refinery</strong> until your chances are high enough that winning is almost guaranteed. the strategy is up to you!
		</p>

		<p class="mb-6">
			one catch: <strong>every time you win an item, your base probability for that item gets halved</strong>. so winning becomes harder each time, but the refinery is always there to help you boost your odds back up!
		</p>
	</div>
</div>

<style>
	:global(body) {
		overflow-x: hidden;
	}
</style>
