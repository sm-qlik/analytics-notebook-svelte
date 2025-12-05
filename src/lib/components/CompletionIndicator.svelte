<script lang="ts">
	interface Props {
		totalApps: number;
		onRefresh: () => void;
	}

	let { totalApps, onRefresh }: Props = $props();
	let showConfirmDialog = $state(false);
	
	function handleRefreshClick() {
		showConfirmDialog = true;
	}
	
	function confirmRefresh() {
		showConfirmDialog = false;
		onRefresh();
	}
	
	function cancelRefresh() {
		showConfirmDialog = false;
	}
</script>

<div class="flex-shrink-0 mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3 flex-1">
			<div class="flex-shrink-0">
				<svg class="h-4 w-4 text-green-600 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<div class="flex-1">
				<p class="text-sm font-medium text-green-900 dark:text-green-100">
					All {totalApps} apps loaded successfully
				</p>
			</div>
		</div>
		<button
			type="button"
			onclick={handleRefreshClick}
			class="ml-4 flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
			title="Refresh data from Qlik tenant"
		>
			<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			Refresh
		</button>
	</div>
</div>

{#if showConfirmDialog}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black/50 z-40"
		onclick={cancelRefresh}
		role="button"
		tabindex="-1"
	></div>
	
	<!-- Dialog -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div 
			class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
			onkeydown={(e) => e.key === 'Escape' && cancelRefresh()}
			tabindex="0"
		>
			<div class="flex items-start gap-4">
				<div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
					<svg class="h-5 w-5 text-amber-600 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
						Refresh All Data?
					</h3>
					<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
						This will regenerate all data from the Qlik tenant and may take some time depending on the number of apps.
					</p>
				</div>
			</div>
			
			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={cancelRefresh}
					class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={confirmRefresh}
					class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
				>
					Refresh Data
				</button>
			</div>
		</div>
	</div>
{/if}

