<script lang="ts">
	interface Props {
		totalApps: number;
		onRefresh: () => void;
	}

	let { totalApps, onRefresh }: Props = $props();
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
			onclick={onRefresh}
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

