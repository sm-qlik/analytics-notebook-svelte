<script lang="ts">
	import * as XLSX from 'xlsx';

	interface SearchResult {
		path: string;
		object: any;
		objectType: string | null;
		context: any;
		file?: string;
		app?: string;
		sheet?: string | null;
		sheetName?: string | null;
		sheetId?: string | null;
		sheetUrl?: string | null;
		chartId?: string | null;
		chartTitle?: string | null;
		chartUrl?: string | null;
		labels?: string[];
	}

	interface Props {
		results: SearchResult[];
		searchQuery: string;
		onExportToExcel: () => void;
		onCopyToClipboard: (text: string, id: string) => void;
		copiedDefinitionId: string | null;
	}

	let { results, searchQuery, onExportToExcel, onCopyToClipboard, copiedDefinitionId }: Props = $props();
</script>

<div class="flex flex-col flex-1 min-h-0 space-y-4">
	<div class="flex items-center justify-between flex-shrink-0">
		<div class="text-sm text-gray-600 dark:text-gray-400">
			Found {results.length} result{results.length !== 1 ? 's' : ''}
			{#if searchQuery.trim()}
				for "{searchQuery}"
			{/if}
		</div>
		{#if results.length > 0}
			<button
				type="button"
				onclick={onExportToExcel}
				class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
				title="Export results to Excel"
			>
				<svg
					class="w-4 h-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				Export to Excel
			</button>
		{/if}
	</div>

	{#if results.length > 0}
		<div class="overflow-y-auto flex-1 min-h-0">
			<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
				<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
					<tr>
						<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
						<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Labels</th>
						<th class="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Definition</th>
						<th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">App</th>
					<th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sheet</th>
					<th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
					<th class="w-[10%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chart Title</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each results as result}
					{@const obj = result.object}
					{@const title = obj?.title || obj?.qAlias || (Array.isArray(obj?.qFieldLabels) && obj.qFieldLabels.length > 0 ? obj.qFieldLabels[0] : '') || 'N/A'}
					{@const definition = obj?.qDef || 'N/A'}
					{@const sheetName = result.sheet || result.sheetName || 'N/A'}
					{@const sheetId = result.sheetId || result.context?.sheetId || null}
					{@const sheetUrl = result.sheetUrl || result.context?.sheetUrl || null}
					{@const chartId = result.chartId || obj?.qInfo?.qId || null}
					{@const chartTitle = result.chartTitle || result.context?.chartTitle || null}
					{@const chartUrl = result.chartUrl || result.context?.chartUrl || null}
					{@const labels = result.labels || []}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="truncate" title={title}>{title}</div>
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								{#if labels.length > 0}
									<div class="flex flex-wrap gap-1">
										{#each labels as label}
											<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" title={label}>
												{label}
											</span>
										{/each}
									</div>
								{:else}
									<span class="text-gray-400">N/A</span>
								{/if}
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="flex items-center gap-2 group">
									<div class="flex-1 truncate" title={definition}>{definition}</div>
									{#if definition !== 'N/A'}
										<button
											type="button"
											onclick={() => onCopyToClipboard(definition, `${result.path}-${result.app}`)}
											class="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
											title="Copy definition to clipboard"
										>
											{#if copiedDefinitionId === `${result.path}-${result.app}`}
												<svg
													class="w-4 h-4 text-green-600 dark:text-green-400"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											{:else}
												<svg
													class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
													/>
												</svg>
											{/if}
										</button>
									{/if}
								</div>
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="truncate" title={result.app}>{result.app}</div>
							</td>
						<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
							{#if sheetUrl && sheetName !== 'N/A'}
								<a
									href={sheetUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="text-blue-600 dark:text-blue-400 hover:underline truncate block"
									title={sheetName}
								>
									{sheetName}
								</a>
							{:else}
								<div class="truncate" title={sheetName}>{sheetName}</div>
							{/if}
						</td>
						<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
							<div class="truncate" title={result.objectType}>{result.objectType}</div>
						</td>
					<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
							{#if chartUrl && chartTitle}
								<a
									href={chartUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="text-blue-600 dark:text-blue-400 hover:underline truncate block"
									title={chartTitle}
								>
									{chartTitle}
								</a>
							{:else}
								<span class="text-gray-400">N/A</span>
							{/if}
						</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div
			class="text-center py-8 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex-1 flex items-center justify-center"
		>
			<p>
				{#if searchQuery.trim()}
					No results found for "{searchQuery}"
				{:else}
					No results found
				{/if}
			</p>
		</div>
	{/if}
</div>

