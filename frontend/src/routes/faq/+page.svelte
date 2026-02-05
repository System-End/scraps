<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';

	interface FAQItem {
		question: string;
		answer: string;
	}

	const faqs: FAQItem[] = [
		{
			question: 'what is scraps?',
			answer: 'scraps is a hack club program where you earn scraps by building projects and spending time coding. you can then spend your scraps in the shop to test your luck and win prizes from hack club hq!'
		},
		{
			question: 'how do i earn scraps?',
			answer: 'you earn scraps by submitting projects you\'ve built. each project is reviewed by our team, and you receive scraps based on the hours you\'ve spent working on it. connect your <a href="https://hackatime.hackclub.com" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">hackatime</a> account to automatically track your coding hours.'
		},
		{
			question: 'what is hackatime?',
			answer: '<a href="https://hackatime.hackclub.com" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">hackatime</a> is hack club\'s time tracking tool that automatically logs your coding hours. connect it to your projects so we can see how much time you\'ve spent building. visit <a href="https://hackatime.hackclub.com" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">hackatime.hackclub.com</a> to get started.'
		},
		{
			question: 'how does the shop work?',
			answer: 'in the shop, you spend scraps to roll for prizes. each item has a base probability of winning. if you don\'t win, you get consolation scrap paper. the cost to roll depends on the item\'s rarity.'
		},
		{
			question: 'what is the refinery?',
			answer: 'the refinery lets you spend scraps to increase your probability of winning an item. each upgrade boosts your chances, but costs increase with each upgrade. it\'s a way to improve your odds before rolling.'
		},
		{
			question: 'what are project tiers?',
			answer: 'projects are assigned tiers (1-4) based on complexity and quality. higher tiers earn more scraps per hour: tier 1 = 0.8x, tier 2 = 1x, tier 3 = 1.25x, tier 4 = 1.5x multiplier.'
		},
		{
			question: 'how long does review take?',
			answer: 'project reviews typically take a few days. our team reviews each submission to verify the work and assign an appropriate tier. you\'ll be notified when your project is approved.'
		},
		{
			question: 'what happens if i lose a roll?',
			answer: 'if you lose a roll, you receive consolation scrap paper as a small prize. your refinery upgrades are kept, so you can try again with improved odds. keep building projects to earn more scraps!'
		},
		{
			question: 'can i submit any project?',
			answer: 'projects should be original work you\'ve built. they need a github repo, description, and tracked hours via <a href="https://hackatime.hackclub.com" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">hackatime</a>. both new projects and improvements to existing ones count!'
		},
		{
			question: 'how do i get started?',
			answer: 'sign in with your hack club account, connect <a href="https://hackatime.hackclub.com" target="_blank" rel="noopener noreferrer" class="underline hover:no-underline">hackatime</a>, and start building! when you\'re ready, submit your project for review. once approved, you\'ll receive scraps based on your hours.'
		}
	];

	let openIndex = $state<number | null>(null);

	function toggle(index: number) {
		openIndex = openIndex === index ? null : index;
	}
</script>

<svelte:head>
	<title>faq - scraps</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 pt-24 pb-24 md:px-12">
	<div class="mb-12 text-center">
		<h1 class="mb-4 text-4xl font-bold md:text-5xl">faq</h1>
		<p class="text-lg text-gray-600">frequently asked questions about scraps</p>
	</div>

	<div class="space-y-4">
		{#each faqs as faq, i}
			<div class="rounded-2xl border-4 border-black transition-all hover:border-dashed">
				<button
					onclick={() => toggle(i)}
					class="flex w-full cursor-pointer items-center justify-between p-6 text-left"
				>
					<span class="text-lg font-bold">{faq.question}</span>
					<ChevronDown
						size={24}
						class="shrink-0 transition-transform duration-200 {openIndex === i
							? 'rotate-180'
							: ''}"
					/>
				</button>
				{#if openIndex === i}
					<div class="border-t-4 border-black px-6 py-4">
						<p class="text-gray-600">{@html faq.answer}</p>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="mt-12 rounded-2xl border-4 border-black bg-gray-50 p-8 text-center">
		<h2 class="mb-4 text-2xl font-bold">still have questions?</h2>
		<p class="mb-6 text-gray-600">
			reach out to us on the hack club slack in the #scraps channel
		</p>
		<a
			href="https://slack.hackclub.com/"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-block cursor-pointer rounded-full bg-black px-8 py-3 font-bold text-white transition-all duration-200 hover:bg-gray-800"
		>
			join hack club slack
		</a>
	</div>
</div>
