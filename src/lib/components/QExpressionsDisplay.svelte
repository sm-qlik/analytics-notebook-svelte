<script>
	let { expressions, searchQuery = '' } = $props();

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

	function formatExpression(expr) {
		if (typeof expr === 'string') {
			return expr;
		}
		if (typeof expr === 'object' && expr !== null) {
			return JSON.stringify(expr, null, 2);
		}
		return String(expr);
	}
</script>

{#if expressions && Array.isArray(expressions) && expressions.length > 0}
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
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/>
			</svg>
			Expressions ({expressions.length})
		</div>
		<div class="space-y-2">
			{#each expressions as expr, index}
				<div class="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
					<div class="text-xs font-mono text-gray-500 dark:text-gray-400 mb-1">
						Expression {index + 1}:
					</div>
					<pre
						class="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words overflow-x-auto"
					>{@html highlightText(formatExpression(expr), searchQuery)}</pre>
				</div>
			{/each}
		</div>
	</div>
{:else if expressions && Array.isArray(expressions) && expressions.length === 0}
	<div class="ml-4 mt-1 text-xs text-gray-400 dark:text-gray-500 italic">
		No expressions
	</div>
{/if}

