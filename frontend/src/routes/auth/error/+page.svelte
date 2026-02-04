<script lang="ts">
	import { page } from '$app/state';
	import { AlertTriangle } from '@lucide/svelte';

	let reason = $derived(page.url.searchParams.get('reason') || 'unknown');

	const errorMessages: Record<
		string,
		{ title: string; description: string; redirectUrl?: string; redirectText?: string }
	> = {
		'needs-verification': {
			title: 'verify your identity',
			description:
				'you need to verify your identity with hack club auth before you can use scraps. click below to complete verification.',
			redirectUrl: 'https://auth.hackclub.com',
			redirectText: 'verify with hack club auth'
		},
		'not-eligible': {
			title: 'not eligible for ysws',
			description:
				'your hack club account is not currently eligible for you ship we ship programs. please ask for help in the hack club slack.'
		},
		'auth-failed': {
			title: 'authentication failed',
			description: "we couldn't verify your identity. please try again."
		},
		unknown: {
			title: 'something went wrong',
			description: 'an unexpected error occurred. please try again later.'
		}
	};

	let errorInfo = $derived(errorMessages[reason] || errorMessages['unknown']);
</script>

<svelte:head>
	<title>error - scraps</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center px-6">
	<div class="max-w-md text-center">
		<div class="mb-6 flex justify-center">
			<div class="flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
				<AlertTriangle size={48} class="text-red-600" />
			</div>
		</div>

		<h1 class="mb-4 text-4xl font-bold md:text-5xl">{errorInfo.title}</h1>
		<p class="mb-8 text-lg text-gray-600">{errorInfo.description}</p>

		<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
			<a
				href="/"
				class="cursor-pointer rounded-full border-4 border-black px-6 py-3 font-bold transition-all hover:border-dashed"
			>
				go back home
			</a>
			{#if errorInfo.redirectUrl}
				<a
					href={errorInfo.redirectUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="cursor-pointer rounded-full bg-black px-6 py-3 font-bold text-white transition-all hover:bg-gray-800"
				>
					{errorInfo.redirectText}
				</a>
			{:else}
				<a
					href="https://hackclub.com/slack"
					target="_blank"
					rel="noopener noreferrer"
					class="cursor-pointer rounded-full bg-black px-6 py-3 font-bold text-white transition-all hover:bg-gray-800"
				>
					get help on slack
				</a>
			{/if}
		</div>
	</div>
</div>
