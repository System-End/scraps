<script lang="ts">
	let {
		title,
		message,
		confirmText = 'confirm',
		cancelText = 'cancel',
		confirmStyle = 'primary',
		loading = false,
		onConfirm,
		onCancel
	}: {
		title: string
		message: string
		confirmText?: string
		cancelText?: string
		confirmStyle?: 'primary' | 'success' | 'warning' | 'danger'
		loading?: boolean
		onConfirm: () => void
		onCancel: () => void
	} = $props()

	function getConfirmClass(): string {
		const base = 'flex-1 px-4 py-2 rounded-full font-bold border-4 border-black transition-all duration-200 disabled:opacity-50 cursor-pointer hover:border-dashed'
		switch (confirmStyle) {
			case 'success':
				return `${base} bg-green-600 text-white`
			case 'warning':
				return `${base} bg-yellow-500 text-white`
			case 'danger':
				return `${base} bg-red-600 text-white`
			default:
				return `${base} bg-black text-white`
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onCancel()
		}
	}
</script>

<div
	class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onCancel()}
	role="dialog"
	tabindex="-1"
>
	<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
		<h2 class="text-2xl font-bold mb-4">{title}</h2>
		<p class="text-gray-600 mb-6">
			{@html message}
		</p>
		<div class="flex gap-3">
			<button
				onclick={onCancel}
				disabled={loading}
				class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
			>
				{cancelText}
			</button>
			<button
				onclick={onConfirm}
				disabled={loading}
				class={getConfirmClass()}
			>
				{loading ? 'loading...' : confirmText}
			</button>
		</div>
	</div>
</div>
