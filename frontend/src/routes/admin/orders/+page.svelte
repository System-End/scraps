<script lang="ts">
	import { onMount } from 'svelte'
	import { goto } from '$app/navigation'
	import { Check, X, Package, Clock, Truck, CheckCircle, XCircle } from '@lucide/svelte'
	import { getUser } from '$lib/auth-client'
	import { API_URL } from '$lib/config'

	interface ShippingAddress {
		firstName: string
		lastName: string
		address1: string
		address2: string | null
		city: string
		state: string
		postalCode: string
		country: string
		phone: string | null
	}

	interface Order {
		id: number
		quantity: number
		pricePerItem: number
		totalPrice: number
		status: string
		orderType: string
		notes: string | null
		isFulfilled: boolean
		shippingAddress: string | null
		createdAt: string
		itemId: number
		itemName: string
		itemImage: string
		userId: number
		username: string
	}

	function parseShippingAddress(addr: string | null): ShippingAddress | null {
		if (!addr) return null
		try {
			return JSON.parse(addr)
		} catch {
			return null
		}
	}

	function formatAddress(addr: ShippingAddress): string {
		const parts = [
			`${addr.firstName} ${addr.lastName}`,
			addr.address1,
			addr.address2,
			`${addr.city}, ${addr.state} ${addr.postalCode}`,
			addr.country
		].filter(Boolean)
		return parts.join(', ')
	}

	interface User {
		id: number
		role: string
	}

	let user = $state<User | null>(null)
	let orders = $state<Order[]>([])
	let loading = $state(true)
	let filter = $state<'all' | 'pending' | 'fulfilled'>('all')

	let filteredOrders = $derived(
		filter === 'all'
			? orders
			: filter === 'pending'
				? orders.filter((o) => !o.isFulfilled)
				: orders.filter((o) => o.isFulfilled)
	)

	onMount(async () => {
		user = await getUser()
		if (!user || user.role !== 'admin') {
			goto('/dashboard')
			return
		}

		await fetchOrders()
	})

	async function fetchOrders() {
		loading = true
		try {
			const response = await fetch(`${API_URL}/admin/orders`, {
				credentials: 'include'
			})
			if (response.ok) {
				orders = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch orders:', e)
		} finally {
			loading = false
		}
	}

	async function toggleFulfilled(order: Order) {
		try {
			const response = await fetch(`${API_URL}/admin/orders/${order.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ isFulfilled: !order.isFulfilled })
			})
			if (response.ok) {
				orders = orders.map((o) =>
					o.id === order.id ? { ...o, isFulfilled: !o.isFulfilled } : o
				)
			}
		} catch (e) {
			console.error('Failed to update order:', e)
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'pending':
				return Clock
			case 'processing':
				return Package
			case 'shipped':
				return Truck
			case 'delivered':
				return CheckCircle
			case 'cancelled':
				return XCircle
			default:
				return Clock
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-700 border-yellow-600'
			case 'processing':
				return 'bg-blue-100 text-blue-700 border-blue-600'
			case 'shipped':
				return 'bg-purple-100 text-purple-700 border-purple-600'
			case 'delivered':
				return 'bg-green-100 text-green-700 border-green-600'
			case 'cancelled':
				return 'bg-red-100 text-red-700 border-red-600'
			default:
				return 'bg-gray-100 text-gray-700 border-gray-600'
		}
	}
</script>

<svelte:head>
	<title>orders - admin - scraps</title>
</svelte:head>

<div class="pt-24 px-6 md:px-12 max-w-6xl mx-auto pb-24">
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-4xl md:text-5xl font-bold mb-2">orders</h1>
			<p class="text-lg text-gray-600">manage shop orders and fulfillment</p>
		</div>
	</div>

	<!-- Filter tabs -->
	<div class="flex gap-2 mb-6">
		<button
			onclick={() => (filter = 'all')}
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {filter ===
			'all'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
		>
			all ({orders.length})
		</button>
		<button
			onclick={() => (filter = 'pending')}
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {filter ===
			'pending'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
		>
			pending ({orders.filter((o) => !o.isFulfilled).length})
		</button>
		<button
			onclick={() => (filter = 'fulfilled')}
			class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer {filter ===
			'fulfilled'
				? 'bg-black text-white'
				: 'hover:border-dashed'}"
		>
			fulfilled ({orders.filter((o) => o.isFulfilled).length})
		</button>
	</div>

	{#if loading}
		<div class="text-center py-12 text-gray-500">loading...</div>
	{:else if filteredOrders.length === 0}
		<div class="text-center py-12 text-gray-500">no orders found</div>
	{:else}
		<div class="grid gap-4">
			{#each filteredOrders as order}
				{@const StatusIcon = getStatusIcon(order.status)}
				<div
					class="border-4 border-black rounded-2xl p-4 {order.isFulfilled
						? 'bg-green-50'
						: ''}"
				>
					<div class="flex items-start gap-4">
						<!-- Item image -->
						<img
							src={order.itemImage}
							alt={order.itemName}
							class="w-16 h-16 rounded-lg border-2 border-black object-cover shrink-0"
						/>

						<!-- Order details -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 mb-1">
								<h3 class="font-bold text-lg">{order.itemName}</h3>
								<span class="text-gray-500">×{order.quantity}</span>
							</div>

							<div class="flex flex-wrap items-center gap-2 mb-2">
								<a
									href="/admin/users/{order.userId}"
									class="text-sm font-bold hover:underline"
								>
									@{order.username}
								</a>
								<span class="text-gray-400">•</span>
								<span class="text-sm text-gray-500">{formatDate(order.createdAt)}</span>
								<span class="text-gray-400">•</span>
								<span class="text-sm font-bold">{order.totalPrice} scraps</span>
							</div>

							<div class="flex flex-wrap items-center gap-2">
								<span
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border-2 {getStatusColor(
										order.status
									)}"
								>
									<StatusIcon size={12} />
									{order.status}
								</span>

								<span
									class="px-2 py-0.5 rounded-full text-xs font-bold border-2 {order.orderType ===
									'win'
										? 'bg-purple-100 text-purple-700 border-purple-600'
										: 'bg-gray-100 text-gray-700 border-gray-600'}"
								>
									{order.orderType}
								</span>

								{#if order.isFulfilled}
									<span
										class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border-2 bg-green-100 text-green-700 border-green-600"
									>
										<Check size={12} />
										fulfilled
									</span>
								{/if}
							</div>

							{#if order.notes}
								<p class="text-sm text-gray-600 mt-2">{order.notes}</p>
							{/if}

							{#if parseShippingAddress(order.shippingAddress)}
								{@const shippingAddr = parseShippingAddress(order.shippingAddress)!}
								<div class="mt-2 p-2 bg-gray-100 rounded-lg border border-gray-300">
									<p class="text-xs font-bold text-gray-500 mb-1">shipping address</p>
									<p class="text-sm">{formatAddress(shippingAddr)}</p>
									{#if shippingAddr.phone}
										<p class="text-xs text-gray-500 mt-1">📞 {shippingAddr.phone}</p>
									{/if}
								</div>
							{:else if order.orderType === 'win'}
								<div class="mt-2 p-2 bg-yellow-100 rounded-lg border border-yellow-300">
									<p class="text-xs font-bold text-yellow-700">⚠️ no shipping address provided</p>
								</div>
							{/if}
						</div>

						<!-- Actions -->
						<div class="shrink-0">
							<button
								onclick={() => toggleFulfilled(order)}
								class="px-4 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 {order.isFulfilled
									? 'bg-gray-200 hover:bg-gray-300'
									: 'bg-green-500 text-white hover:bg-green-600'}"
							>
								{#if order.isFulfilled}
									<X size={16} />
									unfulfill
								{:else}
									<Check size={16} />
									fulfill
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
