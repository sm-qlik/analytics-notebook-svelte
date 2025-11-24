<script lang="ts">
	interface Props {
		current: number;
		total: number;
		currentApp: string;
	}

	let { current, total, currentApp }: Props = $props();
</script>

<div class="flex-shrink-0 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3 flex-1">
			<div class="flex-shrink-0">
				<svg class="animate-spin h-4 w-4 text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-blue-900 dark:text-blue-100">
					Loading app data: {current} of {total} apps
				</p>
				{#if currentApp}
					<p class="text-xs text-blue-700 dark:text-blue-300 truncate">
						Currently loading: {currentApp}
					</p>
				{/if}
				<div class="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
					<div 
						class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
						style="width: {total > 0 ? (current / total) * 100 : 0}%"
					></div>
				</div>
			</div>
		</div>
	</div>
</div>

