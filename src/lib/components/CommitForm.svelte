<script lang="ts">
	import type { ProjectResource } from '$lib/types';
	import { getResourceTypeInfo } from '$lib/types';

	interface Props {
		resources: ProjectResource[];
		projectName: string;
		onSubmit: (summary: string, description: string) => void;
		onCancel: () => void;
	}

	let { resources, projectName, onSubmit, onCancel }: Props = $props();

	let summary = $state('');
	let description = $state('');
	let isSubmitting = $state(false);

	const canSubmit = $derived(summary.trim().length > 0 && summary.trim().length <= 100);

	async function handleSubmit() {
		if (!canSubmit || isSubmitting) return;
		
		isSubmitting = true;
		try {
			await onSubmit(summary.trim(), description.trim());
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSubmit();
		}
	}
</script>

<div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
	<!-- Header -->
	<div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
			Create Commit
		</h3>
		<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
			Commit the current state of <span class="font-medium">{projectName}</span>
		</p>
	</div>

	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="p-6 space-y-6">
		<!-- Summary -->
		<div>
			<label for="commit-summary" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Summary <span class="text-red-500">*</span>
			</label>
			<input
				id="commit-summary"
				type="text"
				bind:value={summary}
				onkeydown={handleKeydown}
				placeholder="Brief description of changes..."
				maxlength="100"
				class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
			/>
			<div class="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
				<span>A short, descriptive summary of your changes</span>
				<span>{summary.length}/100</span>
			</div>
		</div>

		<!-- Description -->
		<div>
			<label for="commit-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
				Description <span class="text-gray-400">(optional)</span>
			</label>
			<textarea
				id="commit-description"
				bind:value={description}
				onkeydown={handleKeydown}
				placeholder="Add a more detailed description of what changed and why..."
				rows="4"
				class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
			></textarea>
			<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				Markdown formatting is supported
			</div>
		</div>

		<!-- Resources being committed -->
		<div>
			<h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
				Resources in this commit ({resources.length})
			</h4>
			<div class="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
				{#each resources as resource}
					{@const info = getResourceTypeInfo(resource.resourceType)}
					<div class="flex items-center gap-3 px-4 py-2.5">
						<div class="flex-shrink-0">
							<span class="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700">
								{#if resource.resourceType === 'app'}
									<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
									</svg>
								{:else if resource.resourceType === 'automation'}
									<svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								{:else}
									<svg class="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
									</svg>
								{/if}
							</span>
						</div>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium text-gray-900 dark:text-white truncate">
								{resource.name}
							</div>
							<div class="text-xs text-gray-500 dark:text-gray-400">
								{info.label}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
			<button
				type="button"
				onclick={onCancel}
				class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={!canSubmit || isSubmitting}
				class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
			>
				{#if isSubmitting}
					<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
					Committing...
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					Create Commit
				{/if}
			</button>
		</div>
	</form>
</div>

