<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { ArrowLeft, Package, CheckCircle, Clock, Truck, MapPin, Origami, Spool } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { getUser } from '$lib/auth-client'

	interface Order {
		id: number
		quantity: number
		pricePerItem: number
		totalPrice: number
		status: string
		orderType: string
		shippingAddress: string | null
		isFulfilled: boolean
		createdAt: string
		itemId: number
		itemName: string
		itemImage: string
	}

	let orders = $state<Order[]>([])
	let loading = $state(true)
	let error = $state<string | null>(null)

	onMount(async () => {
		const user = await getUser()
		if (!user) {
			goto('/')
			return
		}

		try {
			const response = await fetch(`${API_URL}/shop/orders`, {
				credentials: 'include'
			})

			if (!response.ok) {
				throw new Error('Failed to fetch orders')
			}

			const data = await response.json()
			if (data.error) {
				throw new Error(data.error)
			}

			orders = data
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load orders'
		} finally {
			loading = false
		}
	})

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	function getOrderTypeLabel(orderType: string): string {
		switch (orderType) {
			case 'luck_win':
				return 'won'
			case 'consolation':
				return 'consolation'
			case 'purchase':
				return 'purchased'
			default:
				return orderType
		}
	}

	function getStatusColor(status: string, isFulfilled: boolean): string {
		if (isFulfilled) return 'bg-green-100 text-green-700 border-green-600'
		switch (status) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-700 border-yellow-600'
			case 'shipped':
				return 'bg-blue-100 text-blue-700 border-blue-600'
			case 'delivered':
				return 'bg-green-100 text-green-700 border-green-600'
			default:
				return 'bg-gray-100 text-gray-700 border-gray-600'
		}
	}

	function getStatusIcon(status: string, isFulfilled: boolean) {
		if (isFulfilled) return CheckCircle
		switch (status) {
			case 'shipped':
				return Truck
			case 'delivered':
				return CheckCircle
			default:
				return Clock
		}
	}

	function getStatusLabel(status: string, isFulfilled: boolean): string {
		if (isFulfilled) return 'fulfilled'
		return status
	}

	interface ParsedAddress {
		firstName?: string
		lastName?: string
		address1?: string
		address2?: string | null
		city?: string
		state?: string
		postalCode?: string
		country?: string
		phone?: string
	}

	function parseAddress(addressJson: string): ParsedAddress | null {
		try {
			return JSON.parse(addressJson)
		} catch {
			return null
		}
	}

	function formatAddress(addressJson: string): string {
		const addr = parseAddress(addressJson)
		if (!addr) return addressJson

		const parts: string[] = []
		if (addr.firstName || addr.lastName) {
			parts.push([addr.firstName, addr.lastName].filter(Boolean).join(' '))
		}
		if (addr.address1) parts.push(addr.address1)
		if (addr.address2) parts.push(addr.address2)
		if (addr.city || addr.state || addr.postalCode) {
			const cityLine = [addr.city, addr.state].filter(Boolean).join(', ')
			parts.push([cityLine, addr.postalCode].filter(Boolean).join(' '))
		}
		if (addr.country) parts.push(addr.country)

		return parts.join(', ')
	}
</script>

<svelte:head>
	<title>my orders - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-4xl mx-auto pb-24">
	<a
		href="/shop"
		class="inline-flex items-center gap-2 mb-8 font-bold hover:underline cursor-pointer"
	>
		<ArrowLeft size={20} />
		back to shop
	</a>

	<h1 class="text-4xl md:text-5xl font-bold mb-8">my orders</h1>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading orders...</div>
	{:else if error}
		<div class="text-center py-12 text-red-600">{error}</div>
	{:else if orders.length === 0}
		<div class="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center">
			<Package size={48} class="mx-auto text-gray-400 mb-4" />
			<p class="text-gray-500 text-lg">no orders yet</p>
			<p class="text-gray-400 text-sm mt-2">try your luck in the shop to get some goodies!</p>
			<a
				href="/shop"
				class="inline-block mt-6 px-6 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 cursor-pointer"
			>
				go to shop
			</a>
		</div>
	{:else}
		<div class="space-y-4">
			{#each orders as order}
				{@const StatusIcon = getStatusIcon(order.status, order.isFulfilled)}
				{@const isConsolation = order.orderType === 'consolation'}
				<div class="border-4 border-black rounded-2xl p-6 hover:border-dashed transition-all duration-200">
					<div class="flex gap-4">
						{#if isConsolation}
							<div class="w-20 h-20 rounded-lg border-2 border-black bg-yellow-50 shrink-0 flex items-center justify-center">
								<Origami size={40} class="text-yellow-600" />
							</div>
						{:else}
							<img
								src={order.itemImage}
								alt={order.itemName}
								class="w-20 h-20 object-contain rounded-lg border-2 border-black bg-gray-50 shrink-0"
							/>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="flex items-start justify-between gap-4">
								<div>
									{#if isConsolation}
										<h3 class="font-bold text-xl">paper scraps</h3>
										<p class="text-sm text-gray-400 line-through">{order.itemName}</p>
									{:else}
										<h3 class="font-bold text-xl">{order.itemName}</h3>
									{/if}
									<p class="text-sm text-gray-500">
										{getOrderTypeLabel(order.orderType)} · {formatDate(order.createdAt)}
									</p>
								</div>
								<span
									class="shrink-0 px-3 py-1 rounded-full text-sm font-bold border-2 flex items-center gap-1 {getStatusColor(order.status, order.isFulfilled)}"
								>
									<StatusIcon size={14} />
									{getStatusLabel(order.status, order.isFulfilled)}
								</span>
							</div>

							<div class="mt-3 flex flex-wrap gap-4 text-sm">
								<span class="text-gray-600 font-bold flex items-center gap-1">
									<Spool size={16} />
									{order.totalPrice}
								</span>
								{#if order.quantity > 1}
									<span class="text-gray-600">qty: {order.quantity}</span>
								{/if}
							</div>

							{#if order.shippingAddress}
								<div class="mt-3 flex items-start gap-2 text-sm text-gray-600">
									<MapPin size={16} class="shrink-0 mt-0.5" />
									<span class="break-words">{formatAddress(order.shippingAddress)}</span>
								</div>
							{:else if !order.isFulfilled}
								<p class="mt-3 text-sm text-yellow-600 font-bold">
									⚠️ no shipping address provided
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
