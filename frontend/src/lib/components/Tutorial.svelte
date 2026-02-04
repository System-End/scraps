<script lang="ts">
	import {
		Origami,
		ShoppingBag,
		Flame,
		Trophy,
		Clock,
		Gift,
		Sparkles,
		ArrowRight,
		X,
		LayoutDashboard,
		Plus,
		Layers
	} from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { refreshUserScraps } from '$lib/auth-client'
	import { goto, preloadData } from '$app/navigation'
	import { tutorialActiveStore } from '$lib/stores'
	import { onMount, onDestroy } from 'svelte'

	let { onComplete }: { onComplete: () => void } = $props()

	let currentStep = $state(0)
	let loading = $state(false)

	// Dragging state
	let isDragging = $state(false)
	let dragOffset = $state({ x: 0, y: 0 })
	let cardOffset = $state<{ x: number; y: number } | null>(null)

	function handleDragStart(e: MouseEvent) {
		isDragging = true
		const card = (e.target as HTMLElement).closest('[data-tutorial-card]') as HTMLElement
		if (card) {
			const rect = card.getBoundingClientRect()
			dragOffset = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top
			}
			if (!cardOffset) {
				cardOffset = { x: rect.left, y: rect.top }
			}
		}
	}

	function handleDragMove(e: MouseEvent) {
		if (!isDragging) return
		cardOffset = {
			x: e.clientX - dragOffset.x,
			y: e.clientY - dragOffset.y
		}
	}

	function handleDragEnd() {
		isDragging = false
	}

	// Reset card position when step changes
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		currentStep
		cardOffset = null
	})

	onMount(() => {
		tutorialActiveStore.set(true)
		window.addEventListener('mousemove', handleDragMove)
		window.addEventListener('mouseup', handleDragEnd)
		// Preload pages that the tutorial will navigate to
		preloadData('/dashboard')
		preloadData('/shop')
	})

	onDestroy(() => {
		tutorialActiveStore.set(false)
		window.removeEventListener('mousemove', handleDragMove)
		window.removeEventListener('mouseup', handleDragEnd)
	})

	const steps = [
		{
			title: 'welcome to scraps!',
			description:
				'scraps is a program where you earn rewards for building cool projects. let\'s walk through how it works!',
			highlight: null
		},
		{
			title: 'navigation',
			description:
				'use the navbar to navigate between dashboard (your projects), shop (spend scraps), refinery (boost odds), and leaderboard (see top builders).',
			highlight: 'navbar'
		},
		{
			title: 'create projects',
			description:
				'start by creating projects on your dashboard. link them to Hackatime (hackatime.hackclub.com) to automatically track your coding time.',
			highlight: 'dashboard'
		},
		{
			title: 'create your first project',
			description:
				'click the "new project" button on the right to open the project creation modal.',
			highlight: 'new-project-button',
			waitForClick: true
		},
		{
			title: 'fill in project details',
			description:
				'we\'ve pre-filled some example text for you. feel free to customize it or just click "create" to continue!',
			highlight: 'create-project-modal',
			waitForEvent: 'tutorial:project-created'
		},
		{
			title: 'your project page',
			description:
				'great job! this is your project page. you can see details, edit your project, and submit it for review when ready.',
			highlight: null,
			position: 'bottom-center'
		},
		{
			title: 'submit for review',
			description:
				'when you\'re ready to ship, click "review & submit" to submit your project. once approved, you\'ll earn scraps based on your coding time!',
			highlight: 'submit-button'
		},
		{
			title: 'project tiers',
			description:
				'when submitting, you can select a tier (1-4) based on your project\'s complexity. higher tiers earn more scraps per hour.',
			highlight: null
		},
		{
			title: 'earn scraps',
			description:
				'you earn scraps for the time you put in. the more you build, the more you earn! your scraps balance is shown here.',
			highlight: 'scraps-counter'
		},
		{
			title: 'the shop',
			description:
				'spend your scraps in the shop to try your luck at winning prizes. each item has a base probability of success.',
			highlight: 'shop'
		},
		{
			title: 'the refinery',
			description:
				'invest scraps in the refinery to boost your probability for specific items. higher probability = better odds!',
			highlight: 'refinery'
		},
		{
			title: 'strategy time',
			description:
				'you have a choice: try your luck at base probability OR invest in the refinery first to boost your odds. choose wisely!',
			highlight: null
		},
		{
			title: 'you\'re ready!',
			description:
				'here\'s 10 bonus scraps to get you started. now go build something awesome!',
			highlight: null
		}
	]

	let currentStepData = $derived(steps[currentStep])
	let isLastStep = $derived(currentStep === steps.length - 1)
	let stepProgress = $derived(`step ${currentStep + 1} of ${steps.length}`)

	function getHighlightPosition(highlight: string | null): {
		top: number
		left: number
		width: number
		height: number
	} | null {
		if (!highlight) return null

		const selectors: Record<string, string> = {
			navbar: 'nav',
			dashboard: 'a[href="/dashboard"]',
			shop: 'a[href="/shop"]',
			refinery: 'a[href="/refinery"]',
			leaderboard: 'a[href="/leaderboard"]',
			'new-project-button': 'button[data-tutorial="new-project"]',
			'create-project-modal': '[data-tutorial="create-project-modal"]',
			'submit-button': '[data-tutorial="submit-button"]',
			'scraps-counter': '[data-tutorial="scraps-counter"]'
		}

		const selector = selectors[highlight]
		if (!selector) return null

		const element = document.querySelector(selector)
		if (!element) return null

		const rect = element.getBoundingClientRect()
		return {
			top: rect.top,
			left: rect.left,
			width: rect.width,
			height: rect.height
		}
	}

	let highlightTick = $state(0)
	let highlightRect = $derived.by(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		highlightTick // trigger reactivity
		return getHighlightPosition(currentStepData.highlight)
	})

	// Re-calculate highlight position after a short delay when step changes
	$effect(() => {
		const highlight = currentStepData.highlight
		if (highlight) {
			const timeout = setTimeout(() => {
				highlightTick++
			}, 100)
			return () => clearTimeout(timeout)
		}
	})

	let cardPosition = $derived.by(() => {
		// Check for explicit position override first
		const explicitPosition = (currentStepData as { position?: string }).position
		if (explicitPosition) {
			return explicitPosition
		}
		const highlight = currentStepData.highlight
		if (highlight === 'navbar' || highlight === 'dashboard' || highlight === 'shop' || highlight === 'refinery' || highlight === 'leaderboard' || highlight === 'scraps-counter') {
			return 'bottom'
		}
		if (highlight === 'create-project-modal' || highlight === 'submit-button') {
			return 'left'
		}
		if (highlight === 'new-project-button') {
			return 'right'
		}
		return 'center'
	})

	$effect(() => {
		if (currentStepData.highlight === 'shop') {
			goto('/shop', { invalidateAll: false })
		} else if (currentStepData.highlight === 'dashboard' || currentStepData.highlight === 'new-project-button') {
			goto('/dashboard', { invalidateAll: false })
		}
	})

	// Listen for clickable element clicks to advance tutorial
	$effect(() => {
		if (currentStepData.waitForClick && currentStepData.highlight) {
			const selectors: Record<string, string> = {
				'new-project-button': 'button[data-tutorial="new-project"]',
				'submit-button': '[data-tutorial="submit-button"]'
			}
			const selector = selectors[currentStepData.highlight]
			if (selector) {
				const element = document.querySelector(selector)
				if (element) {
					const handleClick = () => {
						nextStep()
					}
					element.addEventListener('click', handleClick)
					return () => element.removeEventListener('click', handleClick)
				}
			}
		}
	})

	// Listen for custom events to advance tutorial (e.g., project created)
	$effect(() => {
		const waitForEvent = (currentStepData as { waitForEvent?: string }).waitForEvent
		if (waitForEvent) {
			const handleEvent = () => {
				nextStep()
			}
			window.addEventListener(waitForEvent, handleEvent)
			return () => window.removeEventListener(waitForEvent, handleEvent)
		}
	})

	function nextStep() {
		if (isLastStep) {
			completeTutorial()
		} else {
			currentStep++
		}
	}

	function skip() {
		completeTutorial()
	}

	async function completeTutorial() {
		loading = true
		try {
			await fetch(`${API_URL}/user/complete-tutorial`, {
				method: 'POST',
				credentials: 'include'
			})
			await refreshUserScraps()
			onComplete()
			goto('/dashboard', { invalidateAll: false })
		} catch {
			onComplete()
			goto('/dashboard', { invalidateAll: false })
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		// Don't close on backdrop click when waiting for user to click a specific element
		if (currentStepData.waitForClick) return
		if (e.target === e.currentTarget) {
			skip()
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			skip()
		} else if (e.key === 'ArrowRight' || e.key === 'Enter') {
			nextStep()
		} else if (e.key === 'ArrowLeft' && currentStep > 0) {
			currentStep--
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="fixed inset-0 z-[100] flex items-center justify-center {highlightRect ? 'pointer-events-none' : ''}"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && skip()}
	role="dialog"
	tabindex="-1"
>
	<!-- Dark overlay with cutout for highlighted element -->
	{#if highlightRect}
		<!-- Dark overlay using 4 divs around the spotlight to allow clicking through the cutout -->
		<div class="absolute inset-0 pointer-events-none">
			<!-- Top -->
			<div class="absolute top-0 left-0 right-0 bg-black/75 pointer-events-auto" style="height: {highlightRect.top - 8}px;"></div>
			<!-- Bottom -->
			<div class="absolute bottom-0 left-0 right-0 bg-black/75 pointer-events-auto" style="top: {highlightRect.top + highlightRect.height + 8}px;"></div>
			<!-- Left -->
			<div class="absolute bg-black/75 pointer-events-auto" style="top: {highlightRect.top - 8}px; left: 0; width: {highlightRect.left - 8}px; height: {highlightRect.height + 16}px;"></div>
			<!-- Right -->
			<div class="absolute bg-black/75 pointer-events-auto" style="top: {highlightRect.top - 8}px; right: 0; left: {highlightRect.left + highlightRect.width + 8}px; height: {highlightRect.height + 16}px;"></div>
		</div>
		<!-- Highlight border -->
		<div
			class="absolute border-4 border-white rounded-2xl pointer-events-none animate-pulse"
			style="top: {highlightRect.top - 8}px; left: {highlightRect.left - 8}px; width: {highlightRect.width + 16}px; height: {highlightRect.height + 16}px;"
		></div>
	{:else}
		<div class="absolute inset-0 bg-black/75"></div>
	{/if}

	<!-- Tutorial card -->
	<div
		data-tutorial-card
		class="bg-white rounded-2xl w-full max-w-lg border-4 border-black pointer-events-auto {currentStepData.highlight === 'create-project-modal' ? 'z-[300]' : ''} {cardOffset ? 'fixed' : 'relative mx-4'} {!cardOffset && cardPosition === 'bottom' ? 'mt-auto mb-8' : !cardOffset && cardPosition === 'bottom-center' ? 'mt-auto mb-8' : !cardOffset && cardPosition === 'top' ? 'mb-auto mt-8' : !cardOffset && cardPosition === 'left' ? 'mr-auto ml-8' : !cardOffset && cardPosition === 'right' ? 'ml-auto mr-8' : ''}"
		style={cardOffset ? `left: ${cardOffset.x}px; top: ${cardOffset.y}px;` : ''}
	>
		<!-- Drag handle -->
		<div
			onmousedown={handleDragStart}
			role="toolbar"
			class="flex items-center justify-between px-6 pt-4 pb-2 cursor-move border-b-2 border-dashed border-gray-200 select-none"
		>
			<div class="text-sm text-gray-500 font-bold">{stepProgress}</div>
			<!-- Close button -->
			<button
				onclick={skip}
				class="p-2 hover:bg-gray-100 rounded-full transition-all duration-200 cursor-pointer"
				aria-label="Skip tutorial"
			>
				<X size={20} />
			</button>
		</div>

		<div class="p-6 pt-4">

		<!-- Progress dots -->
		<div class="flex gap-1 mb-6">
			{#each steps as _, i}
				<div
					class="h-1 flex-1 rounded-full transition-all duration-200 {i <= currentStep
						? 'bg-black'
						: 'bg-gray-200'}"
				></div>
			{/each}
		</div>

		<!-- Icon -->
		<div class="w-16 h-16 rounded-full bg-black text-white flex items-center justify-center mb-4">
			{#if currentStep === 0}
				<Origami size={32} />
			{:else if currentStep === 1}
				<LayoutDashboard size={32} />
			{:else if currentStep === 2}
				<Clock size={32} />
			{:else if currentStep === 3}
				<Plus size={32} />
			{:else if currentStep === 4}
				<Gift size={32} />
			{:else if currentStep === 5}
				<Sparkles size={32} />
			{:else if currentStep === 6}
				<ShoppingBag size={32} />
			{:else if currentStep === 7}
				<Layers size={32} />
			{:else if currentStep === 8}
				<Flame size={32} />
			{:else if currentStep === 9}
				<Trophy size={32} />
			{:else}
				<Gift size={32} />
			{/if}
		</div>

		<!-- Title -->
		<h2 class="text-2xl font-bold mb-2">{currentStepData.title}</h2>

		<!-- Description -->
		<p class="text-gray-600 mb-6">{currentStepData.description}</p>

		{#if currentStepData.highlight === null && currentStep === 2}
			<a
				href="https://hackatime.hackclub.com"
				target="_blank"
				rel="noopener noreferrer"
				class="inline-block text-black font-bold underline hover:no-underline mb-4"
			>
				set up hackatime →
			</a>
		{/if}

		<!-- Buttons -->
		<div class="flex gap-3">
			<button
				onclick={skip}
				disabled={loading}
				class="px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
			>
				skip
			</button>
			{#if currentStepData.waitForClick}
				<div class="flex-1 px-4 py-2 bg-gray-200 text-gray-600 rounded-full font-bold flex items-center justify-center gap-2">
					<ArrowRight size={18} />
					<span>click the button to continue</span>
				</div>
			{:else if (currentStepData as { waitForEvent?: string }).waitForEvent}
				<div class="flex-1 px-4 py-2 bg-gray-200 text-gray-600 rounded-full font-bold flex items-center justify-center gap-2">
					<ArrowRight size={18} />
					<span>complete the form to continue</span>
				</div>
			{:else}
				<button
					onclick={nextStep}
					disabled={loading}
					class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2"
				>
					{#if loading}
						<span>completing...</span>
					{:else if isLastStep}
						<Gift size={18} />
						<span>claim 10 scraps</span>
					{:else}
						<span>next</span>
						<ArrowRight size={18} />
					{/if}
				</button>
			{/if}
		</div>
		</div>
	</div>
</div>
