<script>
	let { numFormat, searchQuery = '' } = $props();

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

	function getFormatTypeLabel(type) {
		const types = {
			U: 'Unknown',
			I: 'Integer',
			R: 'Real',
			F: 'Fixed',
			M: 'Money',
			D: 'Date',
			T: 'Time',
			TS: 'Timestamp',
			IV: 'Interval'
		};
		return types[type] || type;
	}

	function formatNumberFormat(numFormat) {
		if (!numFormat) return null;

		const parts = [];
		
		if (numFormat.qType) {
			parts.push(`Type: ${getFormatTypeLabel(numFormat.qType)}`);
		}
		
		if (numFormat.qFmt) {
			parts.push(`Format: ${numFormat.qFmt}`);
		}
		
		if (numFormat.qnDec !== undefined) {
			parts.push(`Decimals: ${numFormat.qnDec}`);
		}
		
		if (numFormat.qUseThou !== undefined) {
			parts.push(`Thousands Separator: ${numFormat.qUseThou ? 'Yes' : 'No'}`);
		}
		
		if (numFormat.qDec) {
			parts.push(`Decimal Separator: "${numFormat.qDec}"`);
		}
		
		if (numFormat.qThou) {
			parts.push(`Thousands Separator: "${numFormat.qThou}"`);
		}

		return parts;
	}
</script>

{#if numFormat && Object.keys(numFormat).length > 0}
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
					d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
				/>
			</svg>
			Number Format
		</div>
		<div class="space-y-1 text-xs">
			{#if numFormat.qType}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Type:</span>
					<span
						class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
					>
						{@html highlightText(getFormatTypeLabel(numFormat.qType), searchQuery)}
					</span>
					<span class="text-gray-400 dark:text-gray-500 font-mono">({numFormat.qType})</span>
				</div>
			{/if}
			{#if numFormat.qFmt}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Format:</span>
					<span class="text-gray-700 dark:text-gray-300 font-mono">
						{@html highlightText(numFormat.qFmt, searchQuery)}
					</span>
				</div>
			{/if}
			{#if numFormat.qnDec !== undefined}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Decimals:</span>
					<span class="text-gray-700 dark:text-gray-300">
						{@html highlightText(String(numFormat.qnDec), searchQuery)}
					</span>
				</div>
			{/if}
			{#if numFormat.qUseThou !== undefined}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Use Thousands:</span>
					<span
						class="px-2 py-0.5 rounded text-xs font-medium {numFormat.qUseThou
							? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
							: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}"
					>
						{numFormat.qUseThou ? 'Yes' : 'No'}
					</span>
				</div>
			{/if}
			{#if numFormat.qDec}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Decimal Sep:</span>
					<span class="text-gray-700 dark:text-gray-300 font-mono">
						"{@html highlightText(numFormat.qDec, searchQuery)}"
					</span>
				</div>
			{/if}
			{#if numFormat.qThou}
				<div class="flex items-center gap-2">
					<span class="font-mono text-gray-500 dark:text-gray-400 min-w-[140px]">Thousands Sep:</span>
					<span class="text-gray-700 dark:text-gray-300 font-mono">
						"{@html highlightText(numFormat.qThou, searchQuery)}"
					</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

