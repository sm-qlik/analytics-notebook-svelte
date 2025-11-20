<script>
	import ColoringDisplay from './ColoringDisplay.svelte';
	import QExpressionsDisplay from './QExpressionsDisplay.svelte';
	import QNumFormatDisplay from './QNumFormatDisplay.svelte';

	let { qMeasure, searchQuery = '' } = $props();

	// Format value for display
	function formatValue(value, query = '') {
		const queryLower = query.toLowerCase();
		
		if (value === null || value === undefined) {
			return '<span class="text-gray-400">null</span>';
		}
		if (typeof value === 'string') {
			if (query && value.toLowerCase().includes(queryLower)) {
				// Escape special regex characters in the query
				const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				const regex = new RegExp(`(${escapedQuery})`, 'gi');
				return `<span class="text-green-700 dark:text-green-300">"${String(value).replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>')}"</span>`;
			}
			return `<span class="text-green-700 dark:text-green-300">"${String(value)}"</span>`;
		}
		if (typeof value === 'number') {
			return `<span class="text-blue-600 dark:text-blue-400">${value}</span>`;
		}
		if (typeof value === 'boolean') {
			return `<span class="text-purple-600 dark:text-purple-400">${value}</span>`;
		}
		if (Array.isArray(value)) {
			return `<span class="text-gray-500">[Array(${value.length})]</span>`;
		}
		if (typeof value === 'object') {
			return `<span class="text-gray-500">{Object}</span>`;
		}
		return String(value);
	}
</script>

<div class="space-y-1">
	{#each Object.entries(qMeasure) as [key, value]}
		{@const queryLower = searchQuery.toLowerCase()}
		{@const isMatch = searchQuery && (
			key.toLowerCase().includes(queryLower) ||
			(typeof value === 'string' && value.toLowerCase().includes(queryLower)) ||
			(typeof value === 'number' && String(value).includes(queryLower))
		)}
		<div class="flex flex-col {isMatch ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}">
			<div class="flex">
				<span class="font-mono text-sm text-gray-600 dark:text-gray-400 mr-2 min-w-[120px]">{key}:</span>
				{#if key === 'coloring'}
					<!-- Special handling for coloring -->
				{:else if key === 'qExpressions'}
					<!-- Special handling for qExpressions -->
				{:else if key === 'qNumFormat'}
					<!-- Special handling for qNumFormat -->
				{:else if Array.isArray(value) && value.length > 0 && typeof value[0] !== 'object'}
					<span class="text-sm">[{@html value.map(v => formatValue(v, searchQuery)).join(', ')}]</span>
				{:else}
					<span class="text-sm">{@html formatValue(value, searchQuery)}</span>
				{/if}
			</div>
			{#if key === 'coloring' && value && typeof value === 'object'}
				<ColoringDisplay coloring={value} {searchQuery} />
			{:else if key === 'qExpressions' && Array.isArray(value)}
				<QExpressionsDisplay expressions={value} {searchQuery} />
			{:else if key === 'qNumFormat' && value && typeof value === 'object'}
				<QNumFormatDisplay numFormat={value} {searchQuery} />
			{/if}
		</div>
	{/each}
</div>

