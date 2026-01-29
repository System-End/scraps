<script lang="ts">
	import { X } from '@lucide/svelte'

	interface Project {
		id: number
		userId: number
		name: string
		description: string
		imageUrl: string
		githubUrl: string
		hours: number
		hackatimeUrl: string
	}

	let {
		project = $bindable<Project | null>(null),
		onClose,
		onSave
	}: {
		project: Project | null
		onClose: () => void
		onSave: (project: Project) => void
	} = $props()

	let editedProject = $state<Project | null>(null)

	$effect(() => {
		if (project) {
			editedProject = { ...project }
		}
	})

	function handleSave() {
		if (editedProject) {
			// TODO: Call API to update project
			onSave(editedProject)
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose()
		}
	}
</script>

{#if project && editedProject}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		role="dialog"
		tabindex="-1"
	>
		<div class="bg-white rounded-2xl w-full max-w-lg p-6 border-4 border-black">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold">edit draft</h2>
				<button onclick={onClose} class="p-1 hover:bg-gray-100 rounded-lg transition-colors">
					<X size={24} />
				</button>
			</div>

			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-bold mb-1">name</label>
					<input
						id="name"
						type="text"
						bind:value={editedProject.name}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="description" class="block text-sm font-bold mb-1">description</label>
					<textarea
						id="description"
						bind:value={editedProject.description}
						rows="3"
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed resize-none"
					></textarea>
				</div>

				<div>
					<label for="imageUrl" class="block text-sm font-bold mb-1">image url</label>
					<input
						id="imageUrl"
						type="url"
						bind:value={editedProject.imageUrl}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="githubUrl" class="block text-sm font-bold mb-1">github url</label>
					<input
						id="githubUrl"
						type="url"
						bind:value={editedProject.githubUrl}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="hackatimeUrl" class="block text-sm font-bold mb-1">hackatime url</label>
					<input
						id="hackatimeUrl"
						type="url"
						bind:value={editedProject.hackatimeUrl}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>

				<div>
					<label for="hours" class="block text-sm font-bold mb-1">hours</label>
					<input
						id="hours"
						type="number"
						bind:value={editedProject.hours}
						class="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-dashed"
					/>
				</div>
			</div>

			<div class="flex gap-3 mt-6">
				<button
					onclick={onClose}
					class="flex-1 px-4 py-2 border-2 border-black rounded-full font-bold hover:border-dashed transition-all"
				>
					cancel
				</button>
				<button
					onclick={handleSave}
					class="flex-1 px-4 py-2 bg-black text-white rounded-full font-bold hover:bg-gray-800 transition-all"
				>
					save
				</button>
			</div>
		</div>
	</div>
{/if}
