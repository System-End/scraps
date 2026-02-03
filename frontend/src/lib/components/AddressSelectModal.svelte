<script lang="ts">
	import { ChevronDown, ExternalLink } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { onMount } from 'svelte'

	interface Address {
		id: string
		first_name: string
		last_name: string
		line_1: string
		line_2: string | null
		city: string
		state: string
		postal_code: string
		country: string
		phone_number: string | null
		primary: boolean
	}

	import type { Snippet } from 'svelte'

	let {
		orderId,
		itemName,
		onClose,
		onComplete,
		header
	}: {
		orderId: number
		itemName: string
		onClose: () => void
		onComplete: () => void
		header?: Snippet
	} = $props()

	let addresses = $state<Address[]>([])
	let selectedAddressId = $state<string | null>(null)
	let showDropdown = $state(false)
	let loading = $state(false)
	let loadingAddresses = $state(true)
	let error = $state<string | null>(null)

	let selectedAddress = $derived(addresses.find((a) => a.id === selectedAddressId))
	let canSubmit = $derived(selectedAddressId !== null)

	onMount(async () => {
		try {
			const response = await fetch(`${API_URL}/shop/addresses`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				addresses = Array.isArray(data) ? data : []
				const primary = addresses.find((a) => a.primary)
				if (primary) {
					selectedAddressId = primary.id
				} else if (addresses.length === 1) {
					selectedAddressId = addresses[0].id
				}
			}
		} catch (e) {
			console.error('Failed to fetch addresses:', e)
		} finally {
			loadingAddresses = false
		}
	})

	function selectAddress(id: string) {
		selectedAddressId = id
		showDropdown = false
	}

	function getSelectedAddressLabel(): string {
		const addr = addresses.find((a) => a.id === selectedAddressId)
		if (addr) return `${addr.first_name} ${addr.last_name}, ${addr.city}`
		return 'select an address'
	}

	async function handleSubmit() {
		if (!canSubmit || !selectedAddress) return

		loading = true
		error = null

		const shippingAddress = JSON.stringify({
			firstName: selectedAddress.first_name,
			lastName: selectedAddress.last_name,
			address1: selectedAddress.line_1,
			address2: selectedAddress.line_2 || null,
			city: selectedAddress.city,
			state: selectedAddress.state,
			postalCode: selectedAddress.postal_code,
			country: selectedAddress.country,
			phone: selectedAddress.phone_number || null
		})

		try {
			const response = await fetch(`${API_URL}/shop/orders/${orderId}/address`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include',
				body: JSON.stringify({ shippingAddress })
			})

			if (!response.ok) {
				const data = await response.json().catch(() => ({}))
				throw new Error(data.message || 'Failed to save address')
			}

			onComplete()
			onClose()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save address'
		} finally {
			loading = false
		}
	}
</script>

<div
	class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
	role="dialog"
	tabindex="-1"
>
	<div
		class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black max-h-[90vh] overflow-y-auto"
	>
		<div class="mb-6">
			<h2 class="text-2xl font-bold">shipping address</h2>
		</div>

		{#if header}
			{@render header()}
		{:else}
			<div class="mb-6 p-4 border-2 border-black rounded-lg bg-gray-50">
				<p class="text-lg font-bold">🎉 congratulations!</p>
				<p class="text-gray-600 mt-1">
					you won <span class="font-bold">{itemName}</span>! select your shipping address to receive
					it.
				</p>
			</div>
		{/if}

		{#if error}
			<div class="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-lg text-red-700 text-sm">
				{error}
			</div>
		{/if}

		<div class="space-y-4">
			{#if loadingAddresses}
				<div class="text-center py-4 text-gray-500">loading addresses...</div>
			{:else if addresses.length > 0}
				<div>
					<label class="block text-sm font-bold mb-1">your addresses</label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed text-left flex items-center justify-between cursor-pointer"
						>
							<span class={selectedAddressId ? '' : 'text-gray-500'}
								>{getSelectedAddressLabel()}</span
							>
							<ChevronDown
								size={20}
								class={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'}
							/>
						</button>

						{#if showDropdown}
							<div
								class="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black rounded-lg max-h-48 overflow-y-auto z-10"
							>
								{#each addresses as addr}
									<button
										type="button"
										onclick={() => selectAddress(addr.id)}
										class="w-full px-4 py-2 text-left hover:bg-gray-100 cursor-pointer {addr.id ===
										selectedAddressId
											? 'bg-gray-100'
											: ''}"
									>
										<span class="font-medium"
											>{addr.first_name} {addr.last_name}
											{#if addr.primary}<span class="text-xs text-gray-500">(primary)</span>{/if}</span
										>
										<span class="text-gray-500 text-sm block">{addr.line_1}, {addr.city}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				{#if selectedAddress}
					<div class="p-4 border-2 border-black rounded-lg bg-gray-50">
						<p class="text-sm font-bold mb-2">selected address:</p>
						<p class="text-sm">{selectedAddress.first_name} {selectedAddress.last_name}</p>
						<p class="text-sm">{selectedAddress.line_1}</p>
						{#if selectedAddress.line_2}
							<p class="text-sm">{selectedAddress.line_2}</p>
						{/if}
						<p class="text-sm">
							{selectedAddress.city}, {selectedAddress.state}
							{selectedAddress.postal_code}
						</p>
						<p class="text-sm">{selectedAddress.country}</p>
						{#if selectedAddress.phone_number}
							<p class="text-sm text-gray-500 mt-1">📞 {selectedAddress.phone_number}</p>
						{/if}
					</div>
				{/if}

				<a
					href="https://auth.hackclub.com"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors"
				>
					<ExternalLink size={14} />
					manage addresses on hack club auth
				</a>
			{:else}
				<div class="text-center py-6">
					<p class="text-gray-600 mb-4">you don't have any saved addresses yet.</p>
					<a
						href="https://auth.hackclub.com"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 cursor-pointer"
					>
						<ExternalLink size={16} />
						add an address on hack club
					</a>
					<p class="text-sm text-gray-500 mt-4">
						after adding an address, refresh this page to select it.
					</p>
				</div>
			{/if}
		</div>

		{#if addresses.length > 0}
			<div class="mt-6">
				<button
					onclick={handleSubmit}
					disabled={loading || !canSubmit}
					class="w-full px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
				>
					{loading ? 'saving...' : 'confirm shipping address'}
				</button>
			</div>
		{/if}
	</div>
</div>
