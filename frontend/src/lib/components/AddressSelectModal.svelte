<script lang="ts">
	import { X, ChevronDown } from '@lucide/svelte'
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

	let {
		orderId,
		itemName,
		onClose,
		onComplete
	}: {
		orderId: number
		itemName: string
		onClose: () => void
		onComplete: () => void
	} = $props()

	let addresses = $state<Address[]>([])
	let selectedAddressId = $state<string | null>(null)
	let showDropdown = $state(false)
	let loading = $state(false)
	let loadingAddresses = $state(true)
	let error = $state<string | null>(null)

	let firstName = $state('')
	let lastName = $state('')
	let address1 = $state('')
	let address2 = $state('')
	let city = $state('')
	let stateProvince = $state('')
	let postalCode = $state('')
	let country = $state('')
	let phone = $state('')

	let useNewAddress = $derived(addresses.length === 0 || selectedAddressId === 'new')
	let formValid = $derived(
		firstName.trim() !== '' &&
		lastName.trim() !== '' &&
		address1.trim() !== '' &&
		city.trim() !== '' &&
		stateProvince.trim() !== '' &&
		postalCode.trim() !== '' &&
		country.trim() !== ''
	)
	let canSubmit = $derived(useNewAddress ? formValid : selectedAddressId !== null)

	onMount(async () => {
		try {
			const response = await fetch(`${API_URL}/shop/addresses`, {
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				addresses = Array.isArray(data) ? data : []
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
		if (id !== 'new') {
			const addr = addresses.find(a => a.id === id)
			if (addr) {
				firstName = addr.first_name
				lastName = addr.last_name
				address1 = addr.line_1
				address2 = addr.line_2 || ''
				city = addr.city
				stateProvince = addr.state
				postalCode = addr.postal_code
				country = addr.country
				phone = addr.phone_number || ''
			}
		} else {
			firstName = ''
			lastName = ''
			address1 = ''
			address2 = ''
			city = ''
			stateProvince = ''
			postalCode = ''
			country = ''
			phone = ''
		}
	}

	function getSelectedAddressLabel(): string {
		if (selectedAddressId === 'new') return 'Enter new address'
		const addr = addresses.find(a => a.id === selectedAddressId)
		if (addr) return `${addr.first_name} ${addr.last_name}, ${addr.city}`
		return 'Select an address'
	}

	async function handleSubmit() {
		if (!canSubmit) return

		loading = true
		error = null

		const shippingAddress = JSON.stringify({
			firstName,
			lastName,
			address1,
			address2: address2 || null,
			city,
			state: stateProvince,
			postalCode,
			country,
			phone: phone || null
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

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}
</script>

<div
	class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="dialog"
	tabindex="-1"
>
	<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black max-h-[90vh] overflow-y-auto">
		<div class="flex items-center justify-between mb-6">
			<h2 class="text-2xl font-bold">shipping address</h2>
			<button onclick={onClose} class="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
				<X size={24} />
			</button>
		</div>

		<div class="mb-6 p-4 border-2 border-black rounded-lg bg-gray-50">
			<p class="text-lg font-bold">🎉 congratulations!</p>
			<p class="text-gray-600 mt-1">you won <span class="font-bold">{itemName}</span>! enter your shipping address to receive it.</p>
		</div>

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
					<label class="block text-sm font-bold mb-1">saved addresses</label>
					<div class="relative">
						<button
							type="button"
							onclick={() => (showDropdown = !showDropdown)}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed text-left flex items-center justify-between cursor-pointer"
						>
							<span class={selectedAddressId ? '' : 'text-gray-500'}>{getSelectedAddressLabel()}</span>
							<ChevronDown size={20} class={showDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
						</button>

						{#if showDropdown}
							<div class="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-black rounded-lg max-h-48 overflow-y-auto z-10">
								{#each addresses as addr}
									<button
										type="button"
										onclick={() => selectAddress(addr.id)}
										class="w-full px-4 py-2 text-left hover:bg-gray-100 cursor-pointer"
									>
										<span class="font-medium">{addr.first_name} {addr.last_name}</span>
										<span class="text-gray-500 text-sm block">{addr.line_1}, {addr.city}</span>
									</button>
								{/each}
								<button
									type="button"
									onclick={() => selectAddress('new')}
									class="w-full px-4 py-2 text-left hover:bg-gray-100 border-t border-gray-200 cursor-pointer"
								>
									<span class="font-medium">+ enter new address</span>
								</button>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			{#if useNewAddress || selectedAddressId}
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="firstName" class="block text-sm font-bold mb-1">first name <span class="text-red-500">*</span></label>
						<input
							id="firstName"
							type="text"
							bind:value={firstName}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
					<div>
						<label for="lastName" class="block text-sm font-bold mb-1">last name <span class="text-red-500">*</span></label>
						<input
							id="lastName"
							type="text"
							bind:value={lastName}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
				</div>

				<div>
					<label for="address1" class="block text-sm font-bold mb-1">address line 1 <span class="text-red-500">*</span></label>
					<input
						id="address1"
						type="text"
						bind:value={address1}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="address2" class="block text-sm font-bold mb-1">address line 2</label>
					<input
						id="address2"
						type="text"
						bind:value={address2}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="city" class="block text-sm font-bold mb-1">city <span class="text-red-500">*</span></label>
						<input
							id="city"
							type="text"
							bind:value={city}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
					<div>
						<label for="stateProvince" class="block text-sm font-bold mb-1">state <span class="text-red-500">*</span></label>
						<input
							id="stateProvince"
							type="text"
							bind:value={stateProvince}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="postalCode" class="block text-sm font-bold mb-1">postal code <span class="text-red-500">*</span></label>
						<input
							id="postalCode"
							type="text"
							bind:value={postalCode}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
					<div>
						<label for="country" class="block text-sm font-bold mb-1">country <span class="text-red-500">*</span></label>
						<input
							id="country"
							type="text"
							bind:value={country}
							class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
						/>
					</div>
				</div>

				<div>
					<label for="phone" class="block text-sm font-bold mb-1">phone number</label>
					<input
						id="phone"
						type="tel"
						bind:value={phone}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>
			{/if}
		</div>

		<div class="flex gap-3 mt-6">
			<button
				onclick={onClose}
				disabled={loading}
				class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
			>
				cancel
			</button>
			<button
				onclick={handleSubmit}
				disabled={loading || !canSubmit}
				class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer"
			>
				{loading ? 'saving...' : 'confirm shipping address'}
			</button>
		</div>
	</div>
</div>
