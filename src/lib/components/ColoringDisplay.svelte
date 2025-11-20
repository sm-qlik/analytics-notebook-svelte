<script>
	let { coloring, searchQuery = '' } = $props();

	function highlightText(text, query) {
		if (!query || !text) return text;
		const queryLower = query.toLowerCase();
		if (text.toLowerCase().includes(queryLower)) {
			const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(`(${escapedQuery})`, 'gi');
			return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
		}
		return text;
	}
</script>

{#if coloring && Object.keys(coloring).length > 0}
	<div class="ml-4 mt-1 p-2 bg-gray-50 dark:bg-gray-900/50 rounded border border-gray-200 dark:border-gray-700">
		<div class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
			<svg
				class="w-3 h-3"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
				/>
			</svg>
			Coloring
		</div>
		<div class="space-y-1 text-xs">
			{#if coloring.colorMapRef}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Color Map:</span>
					<span class="text-gray-700 dark:text-gray-300 font-mono">
						{@html highlightText(coloring.colorMapRef, searchQuery)}
					</span>
				</div>
			{/if}
			{#if coloring.hasValueColors !== undefined}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Has Value Colors:</span>
					<span
						class="px-2 py-0.5 rounded text-xs font-medium {coloring.hasValueColors
							? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
							: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}"
					>
						{coloring.hasValueColors ? 'Yes' : 'No'}
					</span>
				</div>
			{/if}
			{#if coloring.changeHash}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Change Hash:</span>
					<span class="text-gray-600 dark:text-gray-400 font-mono text-[10px]">
						{@html highlightText(coloring.changeHash, searchQuery)}
					</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

