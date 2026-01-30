<script lang="ts">
	import { page } from '$app/state'
	import { AlertTriangle } from '@lucide/svelte'

	let reason = $derived(page.url.searchParams.get('reason') || 'unknown')

	const errorMessages: Record<string, { title: string; description: string }> = {
		'not-eligible': {
			title: 'not eligible for ysws',
			description: 'your hack club account is not currently eligible for you ship we ship programs. this might be because your account needs to be verified first.'
		},
		'auth-failed': {
			title: 'authentication failed',
			description: 'we couldn\'t verify your identity. please try again.'
		},
		'unknown': {
			title: 'something went wrong',
			description: 'an unexpected error occurred. please try again later.'
		}
	}

	let errorInfo = $derived(errorMessages[reason] || errorMessages['unknown'])
</script>

<svelte:head>
	<title>error | scraps</title>
</svelte:head>

<div class="min-h-dvh flex items-center justify-center px-6">
	<div class="max-w-md text-center">
		<div class="flex justify-center mb-6">
			<div class="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
				<AlertTriangle size={48} class="text-red-600" />
			</div>
		</div>
		
		<h1 class="text-4xl md:text-5xl font-bold mb-4">{errorInfo.title}</h1>
		<p class="text-lg text-gray-600 mb-8">{errorInfo.description}</p>
		
		<div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
			<a
				href="/"
				class="px-6 py-3 border-4 border-black rounded-full font-bold hover:border-dashed transition-all"
			>
				go back home
			</a>
			<a
				href="https://hackclub.com/slack"
				target="_blank"
				rel="noopener noreferrer"
				class="px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all"
			>
				get help on slack
			</a>
		</div>
	</div>
</div>
