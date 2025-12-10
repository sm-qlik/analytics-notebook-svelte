<script lang="ts">
	import { loadingProgressStore } from '$lib/stores/loading-progress';
	
	// Auto-subscribe to store (Svelte 5 syntax)
	let progress = $state(loadingProgressStore);
	
	$effect(() => {
		const unsubscribe = loadingProgressStore.subscribe(value => {
			progress = value;
		});
		return unsubscribe;
	});
	
	const isLoading = $derived(progress.isLoading && progress.appItemsCount > 0);
	const isFinished = $derived(!progress.isLoading && progress.appItemsCount > 0);
	const showIndicator = $derived(isLoading || isFinished);
	
	function handleUpdatePage() {
		// Check which view is active and call the appropriate refresh function
		// For search view, refresh table; for chart finder, refresh chart finder
		if (progress.onRefreshChartFinder) {
			progress.onRefreshChartFinder();
		} else if (progress.onRefreshTable) {
			progress.onRefreshTable();
		}
	}
	
	function handleCheckForUpdates() {
		if (progress.onCheckForUpdates) {
			progress.onCheckForUpdates();
		}
	}
</script>

{#if showIndicator}
	<div class="flex items-center gap-2 px-2 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
		{#if isLoading}
			<!-- Loading State -->
			<div class="flex items-center gap-2">
				<svg class="animate-spin h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<div class="flex items-center gap-1.5 min-w-0">
					<span class="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
						{progress.current}/{progress.total}
					</span>
					<div class="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
						<div 
							class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
							style="width: {progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%"
						></div>
					</div>
				</div>
				{#if progress.hasNewData}
					<button
						type="button"
						onclick={handleUpdatePage}
						class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded transition-colors"
						title="Update page"
					>
						<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						Update Page
					</button>
				{/if}
			</div>
		{:else if isFinished}
			<!-- Finished State -->
			<div class="flex items-center gap-2">
				<svg class="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				<span class="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
					{progress.current} apps
				</span>
				<button
					type="button"
					onclick={handleCheckForUpdates}
					class="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
					title="Check for updates"
				>
					<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Check for Updates
				</button>
			</div>
		{/if}
	</div>
{/if}

