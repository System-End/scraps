<script lang="ts">
	import { X, AlertTriangle } from '@lucide/svelte'
	import { errorStore, clearError } from '$lib/stores'

	let error = $derived($errorStore)
</script>

{#if error}
	<div
		class="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4"
		onclick={(e) => e.target === e.currentTarget && clearError()}
		onkeydown={(e) => e.key === 'Escape' && clearError()}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-red-600">
			<div class="flex items-start justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
						<AlertTriangle size={24} class="text-red-600" />
					</div>
					<h2 class="text-2xl font-bold text-red-600">{error.title || 'error'}</h2>
				</div>
				<button
					onclick={clearError}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
					aria-label="Close"
				>
					<X size={20} />
				</button>
			</div>
			<p class="text-gray-600 mb-6">{error.message}</p>
			{#if error.details}
				<div class="mb-6 p-3 bg-gray-100 rounded-lg text-sm text-gray-500 font-mono overflow-x-auto">
					{error.details}
				</div>
			{/if}
			<button
				onclick={clearError}
				class="w-full px-4 py-2 bg-red-600 text-white rounded-full font-bold border-4 border-red-600 hover:border-dashed transition-all duration-200 cursor-pointer"
			>
				dismiss
			</button>
		</div>
	</div>
{/if}
