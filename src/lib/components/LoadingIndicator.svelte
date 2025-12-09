<script lang="ts">
	interface Props {
		current: number;
		total: number;
		currentApp: string;
		hasNewData?: boolean;
		cachedCount?: number;
		isPaused?: boolean;
		pendingCount?: number;
		onRefreshTable?: () => void;
		onDismiss?: () => void;
	}

	let { current, total, currentApp, hasNewData = false, cachedCount = 0, isPaused = false, pendingCount = 0, onRefreshTable, onDismiss }: Props = $props();
</script>

{#if isPaused && pendingCount > 0}
	<div class="flex-shrink-0 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
		<div class="flex items-center gap-3">
			<div class="flex-shrink-0">
				<svg class="h-4 w-4 text-amber-600 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div class="flex-1 min-w-0">
				<p class="text-sm font-medium text-amber-900 dark:text-amber-100">
					Loading paused: {current} of {total} apps loaded
				</p>
				<p class="text-xs text-amber-700 dark:text-amber-300">
					{pendingCount} apps from other spaces waiting. Clear space filter to resume.
				</p>
				<div class="mt-2 w-full bg-amber-200 dark:bg-amber-800 rounded-full h-1.5">
					<div 
						class="bg-amber-500 dark:bg-amber-400 h-1.5 rounded-full transition-all duration-300"
						style="width: {total > 0 ? (current / total) * 100 : 0}%"
					></div>
				</div>
			</div>
			{#if onDismiss}
				<button
					type="button"
					onclick={onDismiss}
					class="flex-shrink-0 p-1 text-amber-500 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded transition-colors"
					aria-label="Dismiss"
					title="Dismiss"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex-shrink-0 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
		<div class="flex items-center justify-between gap-3">
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
						{#if cachedCount > 0}
							<span class="text-blue-600 dark:text-blue-400 font-normal">({cachedCount} from cache)</span>
						{/if}
					</p>
					<p class="text-xs text-blue-700 dark:text-blue-300 truncate h-4">
						{#if currentApp}Currently loading: {currentApp}{:else}&nbsp;{/if}
					</p>
					<div class="mt-2 w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
						<div 
							class="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
							style="width: {total > 0 ? (current / total) * 100 : 0}%"
						></div>
					</div>
				</div>
			</div>
			{#if hasNewData && onRefreshTable}
				<button
					type="button"
					onclick={onRefreshTable}
					class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/50 hover:bg-blue-200 dark:hover:bg-blue-700/50 rounded-md transition-colors"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Refresh Table
				</button>
			{/if}
			<!-- No dismiss button during active loading - only available when paused/finished -->
		</div>
	</div>
{/if}

