<script lang="ts">
	import { X, Spool, Trophy, Heart, ShoppingBag } from '@lucide/svelte'
	import { API_URL } from '$lib/config'
	import { refreshUserScraps, userScrapsStore } from '$lib/auth-client'
	import HeartButton from './HeartButton.svelte'
	import { type ShopItem, updateShopItemHeart } from '$lib/stores'

	interface LeaderboardUser {
		userId: string
		username: string
		avatar: string
		boostPercent: number
		effectiveProbability: number
	}

	interface Buyer {
		userId: string
		username: string
		avatar: string
		purchasedAt: string
	}

	interface HeartUser {
		userId: string
		username: string
		avatar: string
	}

	let {
		item,
		onClose,
		onTryLuck
	}: {
		item: ShopItem
		onClose: () => void
		onTryLuck: (orderId: number) => void
	} = $props()

	let activeTab = $state<'leaderboard' | 'wishlist' | 'buyers'>('leaderboard')
	let leaderboard = $state<LeaderboardUser[]>([])
	let buyers = $state<Buyer[]>([])
	let heartUsers = $state<HeartUser[]>([])
	let loadingLeaderboard = $state(false)
	let loadingBuyers = $state(false)
	let loadingHearts = $state(false)
	let tryingLuck = $state(false)
	let showConfirmation = $state(false)
	let localHearted = $state(item.userHearted)
	let localHeartCount = $state(item.heartCount)
	let canAfford = $derived($userScrapsStore >= item.price)
	let alertMessage = $state<string | null>(null)
	let alertType = $state<'error' | 'info'>('info')

	function getProbabilityColor(prob: number): string {
		if (prob >= 70) return 'text-green-600'
		if (prob >= 40) return 'text-yellow-600'
		return 'text-red-600'
	}

	function getProbabilityBgColor(prob: number): string {
		if (prob >= 70) return 'bg-green-100'
		if (prob >= 40) return 'bg-yellow-100'
		return 'bg-red-100'
	}

	async function fetchLeaderboard() {
		loadingLeaderboard = true
		try {
			const response = await fetch(`${API_URL}/shop/items/${item.id}/leaderboard`, {
				credentials: 'include'
			})
			if (response.ok) {
				leaderboard = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch leaderboard:', e)
		} finally {
			loadingLeaderboard = false
		}
	}

	async function fetchBuyers() {
		loadingBuyers = true
		try {
			const response = await fetch(`${API_URL}/shop/items/${item.id}/buyers`, {
				credentials: 'include'
			})
			if (response.ok) {
				buyers = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch buyers:', e)
		} finally {
			loadingBuyers = false
		}
	}

	async function fetchHeartUsers() {
		loadingHearts = true
		try {
			const response = await fetch(`${API_URL}/shop/items/${item.id}/hearts`, {
				credentials: 'include'
			})
			if (response.ok) {
				heartUsers = await response.json()
			}
		} catch (e) {
			console.error('Failed to fetch heart users:', e)
		} finally {
			loadingHearts = false
		}
	}

	async function handleToggleHeart() {
		try {
			const response = await fetch(`${API_URL}/shop/items/${item.id}/heart`, {
				method: 'POST',
				credentials: 'include'
			})
			if (response.ok) {
				localHearted = !localHearted
				localHeartCount = localHearted ? localHeartCount + 1 : localHeartCount - 1
				// Sync with the store so the shop page updates
				updateShopItemHeart(item.id, localHearted)
			}
		} catch (e) {
			console.error('Failed to toggle heart:', e)
		}
	}

	async function handleTryLuck() {
		tryingLuck = true
		try {
			const response = await fetch(`${API_URL}/shop/items/${item.id}/try-luck`, {
				method: 'POST',
				credentials: 'include'
			})
			const data = await response.json()

			if (!response.ok) {
				alertType = 'error'
				alertMessage = data.error || 'Failed to try luck'
				return
			}

			if (data.won) {
				await refreshUserScraps()
				onTryLuck(data.orderId)
			} else {
				alertType = 'info'
				alertMessage = 'Better luck next time! You rolled ' + data.rolled + ' but needed ' + data.effectiveProbability.toFixed(0) + ' or less.'
			}
		} catch (e) {
			console.error('Failed to try luck:', e)
			alertType = 'error'
			alertMessage = 'Something went wrong'
		} finally {
			tryingLuck = false
			showConfirmation = false
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			if (showConfirmation) {
				showConfirmation = false
			} else {
				onClose()
			}
		}
	}

	let leaderboardFetched = false
	let buyersFetched = false
	let heartsFetched = false

	$effect(() => {
		if (activeTab === 'leaderboard' && !leaderboardFetched) {
			leaderboardFetched = true
			fetchLeaderboard()
		} else if (activeTab === 'buyers' && !buyersFetched) {
			buyersFetched = true
			fetchBuyers()
		} else if (activeTab === 'wishlist' && !heartsFetched) {
			heartsFetched = true
			fetchHeartUsers()
		}
	})
</script>

<div
	class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Escape' && (showConfirmation ? (showConfirmation = false) : onClose())}
	role="dialog"
	tabindex="-1"
>
	<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black max-h-[90vh] overflow-y-auto">
		<div class="flex items-start justify-between mb-4">
			<h2 class="text-2xl font-bold">{item.name}</h2>
			<button onclick={onClose} class="p-1 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
				<X size={24} />
			</button>
		</div>

		<img src={item.image} alt={item.name} class="w-full h-48 object-contain mb-4 bg-gray-50 rounded-lg" />

		<p class="text-gray-600 mb-4">{item.description}</p>

		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-4">
				<span class="text-xl font-bold flex items-center gap-1">
					<Spool size={20} />
					{item.price}
				</span>
				<span class="text-sm text-gray-500">{item.count} left</span>
			</div>
			<HeartButton count={localHeartCount} hearted={localHearted} onclick={() => handleToggleHeart()} />
		</div>

		<div class="flex gap-2 flex-wrap mb-4">
			{#each item.category.split(',').map((c) => c.trim()).filter(Boolean) as cat}
				<span class="text-xs px-2 py-1 bg-gray-100 rounded-full">{cat}</span>
			{/each}
		</div>

		<div class="p-4 border-2 border-black rounded-lg mb-4 {getProbabilityBgColor(item.effectiveProbability)}">
			<p class="text-sm font-bold mb-2">your chance</p>
			<p class="text-3xl font-bold {getProbabilityColor(item.effectiveProbability)}">
				{item.effectiveProbability.toFixed(1)}%
			</p>
			<div class="text-xs text-gray-600 mt-2 flex gap-4">
				<span>base: {item.baseProbability}%</span>
				<span>your boost: +{item.userBoostPercent}%</span>
			</div>
		</div>

		<div class="flex gap-2 mb-4">
			<button
				onclick={() => (activeTab = 'leaderboard')}
				class="flex-1 px-3 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 {activeTab === 'leaderboard'
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				<Trophy size={16} />
				leaderboard
			</button>
			<button
				onclick={() => (activeTab = 'wishlist')}
				class="flex-1 px-3 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 {activeTab === 'wishlist'
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				<Heart size={16} />
				wishlist ({localHeartCount})
			</button>
			<button
				onclick={() => (activeTab = 'buyers')}
				class="flex-1 px-3 py-2 border-4 border-black rounded-full font-bold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 {activeTab === 'buyers'
					? 'bg-black text-white'
					: 'hover:border-dashed'}"
			>
				<ShoppingBag size={16} />
				buyers
			</button>
		</div>

		<div class="border-2 border-black rounded-lg p-4 mb-6 min-h-[120px]">
			{#if activeTab === 'leaderboard'}
				{#if loadingLeaderboard}
					<p class="text-gray-500 text-center">loading...</p>
				{:else if leaderboard.length === 0}
					<p class="text-gray-500 text-center">no one has boosted yet</p>
				{:else}
					<div class="space-y-2">
						{#each leaderboard as user, i}
							<div class="flex items-center gap-3">
								<span class="font-bold w-6">{i + 1}.</span>
								<img src={user.avatar} alt={user.username} class="w-8 h-8 rounded-full" />
								<span class="font-medium flex-1">{user.username}</span>
								<span class="text-sm {getProbabilityColor(user.effectiveProbability)}">
									{user.effectiveProbability.toFixed(1)}%
								</span>
							</div>
						{/each}
					</div>
				{/if}
			{:else if activeTab === 'wishlist'}
				<div class="text-center">
					<p class="text-2xl font-bold mb-2">{localHeartCount}</p>
					<p class="text-gray-600 mb-4">people want this item</p>
					{#if localHearted}
						<p class="text-sm text-green-600 mb-4 font-medium">including you!</p>
					{/if}
					{#if loadingHearts}
						<p class="text-gray-500 text-sm">loading...</p>
					{:else if heartUsers.length > 0}
						<div class="flex flex-wrap justify-center gap-2 mt-2">
							{#each heartUsers as heartUser, i}
								<div
									class="relative"
									style="animation: float 3s ease-in-out infinite; animation-delay: {i * 0.2}s"
								>
									<img
										src={heartUser.avatar}
										alt={heartUser.username}
										title={heartUser.username}
										class="w-10 h-10 rounded-full border-2 border-pink-300 shadow-md hover:scale-110 transition-transform cursor-pointer"
									/>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if activeTab === 'buyers'}
				{#if loadingBuyers}
					<p class="text-gray-500 text-center">loading...</p>
				{:else if buyers.length === 0}
					<p class="text-gray-500 text-center">no one has won this item yet</p>
				{:else}
					<div class="space-y-2">
						{#each buyers as buyer}
							<div class="flex items-center gap-3">
								<img src={buyer.avatar} alt={buyer.username} class="w-8 h-8 rounded-full" />
								<span class="font-medium flex-1">{buyer.username}</span>
								<span class="text-xs text-gray-500">
									{new Date(buyer.purchasedAt).toLocaleDateString()}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<button
			onclick={() => (showConfirmation = true)}
			disabled={item.count === 0 || tryingLuck || !canAfford}
			class="w-full px-4 py-3 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 cursor-pointer text-lg"
		>
			{#if item.count === 0}
				out of stock
			{:else if !canAfford}
				not enough scraps
			{:else}
				try your luck
			{/if}
		</button>
	</div>

	{#if showConfirmation}
		<div
			class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
			onclick={(e) => e.target === e.currentTarget && (showConfirmation = false)}
			onkeydown={(e) => e.key === 'Escape' && (showConfirmation = false)}
			role="dialog"
			tabindex="-1"
		>
			<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
				<h2 class="text-2xl font-bold mb-4">confirm try your luck</h2>
				<p class="text-gray-600 mb-6">
					are you sure you want to try your luck? this will cost <strong>{item.price} scraps</strong>.
					<span class="block mt-2">
						your chance: <strong class={getProbabilityColor(item.effectiveProbability)}>{item.effectiveProbability.toFixed(1)}%</strong>
					</span>
				</p>
				<div class="flex gap-3">
					<button
						onclick={() => (showConfirmation = false)}
						disabled={tryingLuck}
						class="flex-1 px-4 py-2 border-4 border-black rounded-full font-bold hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
					>
						cancel
					</button>
					<button
						onclick={handleTryLuck}
						disabled={tryingLuck}
						class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 disabled:opacity-50 cursor-pointer"
					>
						{tryingLuck ? 'trying...' : 'try luck'}
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if alertMessage}
		<div
			class="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
			onclick={(e) => e.target === e.currentTarget && (alertMessage = null)}
			onkeydown={(e) => e.key === 'Escape' && (alertMessage = null)}
			role="dialog"
			tabindex="-1"
		>
			<div class="bg-white rounded-2xl w-full max-w-md p-6 border-4 border-black">
				<h2 class="text-2xl font-bold mb-4">{alertType === 'error' ? 'error' : 'result'}</h2>
				<p class="text-gray-600 mb-6">{alertMessage}</p>
				<button
					onclick={() => (alertMessage = null)}
					class="w-full px-4 py-2 bg-black text-white rounded-full font-bold border-4 border-black hover:border-dashed transition-all duration-200 cursor-pointer"
				>
					ok
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes float {
		0%, 100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-6px);
		}
	}
</style>
