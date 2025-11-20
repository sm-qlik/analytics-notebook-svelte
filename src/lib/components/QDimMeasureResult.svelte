<script>
	import QDimObject from './QDimObject.svelte';
	import QMeasureObject from './QMeasureObject.svelte';

	let { result, searchQuery = '' } = $props();

	// Determine if this is a qDim or qMeasure object
	const isQDim = result.objectType === 'Master Dimension' || result.objectType === 'Sheet Dimension';
	const isQMeasure = result.objectType === 'Master Measure' || result.objectType === 'Sheet Measure';
</script>

<div
	class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
>
	<div class="flex items-start justify-between mb-3">
		<div class="flex-1">
			<div class="flex items-center gap-2 mb-2 flex-wrap">
				<span
					class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
				>
					{result.app}
				</span>
				<span
					class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
				>
					{result.sheet || result.sheetName || 'No Sheet'}
				</span>
				<span
					class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
				>
					{result.objectType}
				</span>
			</div>
			<div class="text-xs text-gray-500 dark:text-gray-400 font-mono mb-3 break-all">
				{result.path}
			</div>
			<div class="bg-gray-50 dark:bg-gray-900 rounded p-3 border border-gray-200 dark:border-gray-700">
				{#if isQDim}
					<QDimObject qDim={result.object} {searchQuery} />
				{:else if isQMeasure}
					<QMeasureObject qMeasure={result.object} {searchQuery} />
				{/if}
			</div>
		</div>
	</div>
</div>

