<script lang="ts">
	import * as XLSX from 'xlsx';
	import { getColumnValue, type SortableColumn, type SearchResult } from '$lib/utils/table-columns';

	// SearchResult and SortableColumn types imported from utils/table-columns

	interface Props {
		results: SearchResult[];
		totalResults: number;
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		onNextPage: () => void;
		onPreviousPage: () => void;
		searchQuery: string;
		onExportToExcel: () => void;
		onCopyToClipboard: (text: string, id: string) => void;
		copiedDefinitionId: string | null;
		tenantUrl: string | null;
		onToggleFavorite: (appId: string, path: string) => void;
		isFavorite: (appId: string, path: string) => boolean;
	}

	let { results, totalResults, currentPage, totalPages, onPageChange, onNextPage, onPreviousPage, searchQuery, onExportToExcel, onCopyToClipboard, copiedDefinitionId, tenantUrl, onToggleFavorite, isFavorite }: Props = $props();

	let itemsPerPage = $state(25);
	const pageSizeOptions = [25, 50, 100, 200];

	// Sorting state - support all columns
	let sortColumn = $state<SortableColumn>(null);
	let sortDirection = $state<'asc' | 'desc'>('asc');

	/**
	 * Get sortable value for a column.
	 * Delegates to the shared utility function for consistency across table layouts.
	 */
	function getSortValue(result: SearchResult, column: SortableColumn): string {
		return getColumnValue(result, column);
	}

	/**
	 * Sorted results (full dataset).
	 * Applies sorting to all results before pagination.
	 */
	const sortedResults = $derived.by(() => {
		if (!sortColumn) {
			return results;
		}
		
		return [...results].sort((a, b) => {
			const aValue = getSortValue(a, sortColumn);
			const bValue = getSortValue(b, sortColumn);
			const comparison = aValue.localeCompare(bValue);
			return sortDirection === 'asc' ? comparison : -comparison;
		});
	});

	/**
	 * Paginated results from sorted dataset.
	 * Slices the sorted results based on current page.
	 */
	const sortedAndPaginatedResults = $derived.by(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		const endIndex = startIndex + itemsPerPage;
		return sortedResults.slice(startIndex, endIndex);
	});

	/**
	 * Total pages based on sorted results length.
	 * Recalculated when sorting changes to ensure pagination works correctly.
	 */
	const actualTotalPages = $derived(Math.ceil(sortedResults.length / itemsPerPage));

	/**
	 * Toggle sort column and direction.
	 * Clicking the same column toggles direction, clicking a different column sets it to ascending.
	 * Resets to page 1 when sorting changes.
	 */
	function toggleSort(column: SortableColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
		if (currentPage > 1) {
			onPageChange(1);
		}
	}

	// Handle page size change - reset to page 1 if current page would be out of bounds
	function handlePageSizeChange(newSize: number) {
		itemsPerPage = newSize;
		// Reset to page 1 if current page would be out of bounds with new page size
		const newTotalPages = Math.ceil(sortedResults.length / newSize);
		if (currentPage > newTotalPages && newTotalPages > 0) {
			onPageChange(1);
		}
	}

	// Internal page change handlers that validate against actual total pages
	function handlePageChange(page: number) {
		if (page >= 1 && page <= actualTotalPages) {
			onPageChange(page);
		}
	}

	function handleNextPage() {
		if (currentPage < actualTotalPages) {
			onNextPage();
		}
	}

	function handlePreviousPage() {
		if (currentPage > 1) {
			onPreviousPage();
		}
	}

	function getTypeColorClass(type: string | null): string {
		if (!type) return 'text-gray-900 dark:text-gray-100';
		if (type === 'Master Measure') return 'text-blue-700 dark:text-blue-300';
		if (type === 'Master Dimension') return 'text-purple-700 dark:text-purple-300';
		if (type === 'Sheet Measure') return 'text-emerald-700 dark:text-emerald-300';
		if (type === 'Sheet Dimension') return 'text-amber-700 dark:text-amber-300';
		return 'text-gray-900 dark:text-gray-100';
	}

	function getAppUrl(appId: string | undefined): string | null {
		if (!tenantUrl || !appId) return null;
		const cleanTenantUrl = tenantUrl.replace(/^https?:\/\//, '');
		return `https://${cleanTenantUrl}/sense/app/${appId}`;
	}

	function getCopyId(result: SearchResult, field: string): string {
		return `${result.path}-${result.app}-${field}`;
	}

	// Debounced search query for highlighting (only updates after user stops typing for 2 seconds)
	let debouncedQuery = $state('');
	let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
	let isHighlighting = $state(false);
	
	// Debounce the search query for highlighting with 2 second delay
	$effect(() => {
		const query = searchQuery.trim();
		
		// Cancel any pending highlighting immediately when query changes
		isHighlighting = false;
		
		// Clear existing timeout
		if (debounceTimeout) {
			clearTimeout(debounceTimeout);
			debounceTimeout = null;
		}
		
		// Update immediately if query is empty (for instant clearing of highlights)
		if (!query) {
			debouncedQuery = '';
			highlightCache.clear();
			isHighlighting = false;
			return;
		}
		
		// Store the current query for comparison in timeout
		const currentQuery = query;
		
		// Debounce for 0.5 seconds (500ms) - wait until user stops typing
		debounceTimeout = setTimeout(() => {
			// Double-check query hasn't changed (using current searchQuery, not the captured one)
			const latestQuery = searchQuery.trim();
			if (latestQuery === currentQuery && latestQuery.length > 0) {
				debouncedQuery = latestQuery;
				highlightCache.clear(); // Clear cache when new query is applied
				// Set highlighting flag after a tiny delay to ensure cache is cleared
				setTimeout(() => {
					if (searchQuery.trim() === latestQuery) {
						isHighlighting = true;
					}
				}, 10);
			}
			debounceTimeout = null;
		}, 500);
		
		return () => {
			if (debounceTimeout) {
				clearTimeout(debounceTimeout);
				debounceTimeout = null;
			}
			isHighlighting = false;
		};
	});
	
	// Highlighting enabled only for substantial queries (2+ characters) and visible results
	// Only highlight when not currently typing (debounced query is set and highlighting is active)
	const shouldHighlight = $derived.by(() => {
		const query = debouncedQuery;
		return isHighlighting && query.length >= 2 && sortedAndPaginatedResults.length > 0 && sortedAndPaginatedResults.length <= itemsPerPage;
	});
	
	// Cache for highlighted text (limited size)
	let highlightCache = new Map<string, string>();
	const MAX_CACHE_SIZE = 500;
	let lastQuery = '';
	
	// Clear cache when debounced query changes (using untrack to avoid reactivity issues)
	$effect(() => {
		const currentQuery = debouncedQuery;
		if (currentQuery !== lastQuery) {
			highlightCache.clear();
			lastQuery = currentQuery;
		}
	});
	
	// Efficient highlighting function - only processes substantial strings
	function highlightText(text: any, query: string): string {
		// Ensure text is a string
		if (text === null || text === undefined) {
			return '';
		}
		const textStr = String(text);
		
		// Early returns for efficiency - check conditions directly
		if (!isHighlighting || !query || query.length < 2 || !textStr || textStr.length === 0) {
			return textStr || '';
		}
		
		// Only process substantial strings (skip very short or very long strings)
		if (textStr.length < 2 || textStr.length > 5000) {
			return textStr;
		}
		
		// Check if highlighting should be enabled (using shouldHighlight derived value)
		if (!shouldHighlight) {
			return textStr;
		}
		
		// Use cache with full text in key to avoid collisions
		const cacheKey = `${textStr.length > 200 ? textStr.substring(0, 200) : textStr}|${query}`;
		if (highlightCache.has(cacheKey)) {
			return highlightCache.get(cacheKey)!;
		}
		
		const queryLower = query.toLowerCase();
		const textLower = textStr.toLowerCase();
		
		// Quick check - if no match, return original
		if (!textLower.includes(queryLower)) {
			if (highlightCache.size < MAX_CACHE_SIZE) {
				highlightCache.set(cacheKey, text);
			}
			return text;
		}
		
		// Find matches efficiently (limit to first 10 matches for performance)
		const matches: Array<{ start: number; end: number }> = [];
		const queryLength = query.length;
		let searchIndex = 0;
		const MAX_MATCHES = 10;
		
		while (searchIndex < textLower.length && matches.length < MAX_MATCHES) {
			const index = textLower.indexOf(queryLower, searchIndex);
			if (index === -1) break;
			matches.push({ start: index, end: index + queryLength });
			searchIndex = index + queryLength;
		}
		
		if (matches.length === 0) {
			if (highlightCache.size < MAX_CACHE_SIZE) {
				highlightCache.set(cacheKey, textStr);
			}
			return textStr;
		}
		
		// Build highlighted string efficiently using array join
		const parts: string[] = [];
		let lastIndex = 0;
		
		for (const match of matches) {
			// Add text before match
			if (match.start > lastIndex) {
				parts.push(escapeHtml(textStr.substring(lastIndex, match.start)));
			}
			// Add highlighted match
			parts.push(`<mark class="bg-yellow-200 dark:bg-yellow-800">${escapeHtml(textStr.substring(match.start, match.end))}</mark>`);
			lastIndex = match.end;
		}
		
		// Add remaining text
		if (lastIndex < textStr.length) {
			parts.push(escapeHtml(textStr.substring(lastIndex)));
		}
		
		const result = parts.join('');
		
		// Cache result (with size limit)
		if (highlightCache.size < MAX_CACHE_SIZE) {
			highlightCache.set(cacheKey, result);
		} else if (highlightCache.size >= MAX_CACHE_SIZE) {
			// Clear cache if it gets too large
			highlightCache.clear();
			highlightCache.set(cacheKey, result);
		}
		
		return result;
	}
	
	// Efficient HTML escaping (using regex instead of DOM to avoid SSR issues)
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
	
	// Function to check if text should be highlighted (for background color)
	function shouldHighlightText(text: any, query: string): boolean {
		if (!shouldHighlight || !query || !text) return false;
		const textStr = String(text);
		return textStr.toLowerCase().includes(query.toLowerCase());
	}
</script>

<div class="flex flex-col">
	<div class="flex items-center justify-between flex-shrink-0 mb-4">
		<div class="text-sm text-gray-600 dark:text-gray-400">
			Found {totalResults} result{totalResults !== 1 ? 's' : ''}
			{#if searchQuery.trim()}
				for "{searchQuery}"
			{/if}
			{#if actualTotalPages > 1}
				<span class="ml-2">(Page {currentPage} of {actualTotalPages})</span>
			{/if}
		</div>
		{#if sortedAndPaginatedResults.length > 0}
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

	{#if sortedAndPaginatedResults.length > 0}
		<div class="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
			<div class="overflow-x-hidden min-w-0">
				<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 min-w-0">
				<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
					<tr>
					  <th class="w-[3%] px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
						<!-- Star column header -->
					  </th>
					  <th 
						class="w-[13%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
						onclick={() => toggleSort('labels')}
						title="Click to sort"
					  >
						<div class="flex items-center gap-1">
							Labels
							{#if sortColumn === 'labels'}
								{#if sortDirection === 'asc'}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							{/if}
						</div>
					  </th>
					  <th 
						class="w-[28%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
						onclick={() => toggleSort('definition')}
						title="Click to sort"
					  >
						<div class="flex items-center gap-1">
							Definition
							{#if sortColumn === 'definition'}
								{#if sortDirection === 'asc'}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							{/if}
						</div>
					  </th>
					  <th 
						class="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
						onclick={() => toggleSort('chartTitle')}
						title="Click to sort"
					  >
						<div class="flex items-center gap-1">
							Chart
							{#if sortColumn === 'chartTitle'}
								{#if sortDirection === 'asc'}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							{/if}
						</div>
					  </th>
					  <th 
						class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
						onclick={() => toggleSort('type')}
						title="Click to sort"
					  >
						<div class="flex items-center gap-1">
							Type
							{#if sortColumn === 'type'}
								{#if sortDirection === 'asc'}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							{/if}
						</div>
					  </th>
					  <th 
						class="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
						onclick={() => toggleSort('app')}
						title="Click to sort"
					  >
						<div class="flex items-center gap-1">
							App
							{#if sortColumn === 'app'}
								{#if sortDirection === 'asc'}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							{/if}
						</div>
					  </th>
					  <th 
						class="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
						onclick={() => toggleSort('sheet')}
						title="Click to sort"
					  >
						<div class="flex items-center gap-1">
							Sheet
							{#if sortColumn === 'sheet'}
								{#if sortDirection === 'asc'}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
									</svg>
								{:else}
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								{/if}
							{/if}
						</div>
					  </th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each sortedAndPaginatedResults as result}
					{@const obj = result.object}
					{@const title = (() => {
						if (!obj) return 'N/A';
						// Try title
						if (obj.title) {
							if (typeof obj.title === 'string') return obj.title;
							if (typeof obj.title === 'object' && obj.title.qv) return String(obj.title.qv);
							return String(obj.title);
						}
						// Try qAlias
						if (obj.qAlias) {
							if (typeof obj.qAlias === 'string') return obj.qAlias;
							if (typeof obj.qAlias === 'object' && obj.qAlias.qv) return String(obj.qAlias.qv);
							return String(obj.qAlias);
						}
						// Try first qFieldLabel
						if (Array.isArray(obj.qFieldLabels) && obj.qFieldLabels.length > 0) {
							const firstLabel = obj.qFieldLabels[0];
							if (typeof firstLabel === 'string') return firstLabel;
							if (typeof firstLabel === 'object' && firstLabel.qv) return String(firstLabel.qv);
							if (typeof firstLabel === 'object' && firstLabel.qDef) return String(firstLabel.qDef);
							return String(firstLabel);
						}
						return 'N/A';
					})()}
					{@const definition = (() => {
						if (!obj) return 'N/A';
						
						// Helper to safely extract string from any value
						function extractString(value: any): string | null {
							if (value === null || value === undefined) return null;
							if (typeof value === 'string') return value.trim() || null;
							if (typeof value === 'object') {
								// Try common Qlik object properties
								if (value.qv && typeof value.qv === 'string') return value.qv.trim() || null;
								if (value.qDef && typeof value.qDef === 'string') return value.qDef.trim() || null;
								if (value.qDef && typeof value.qDef === 'object' && value.qDef.qv) {
									return String(value.qDef.qv).trim() || null;
								}
								// If it's an array, try to stringify the first element
								if (Array.isArray(value) && value.length > 0) {
									return extractString(value[0]);
								}
								// Last resort: try to find any string property
								for (const key in value) {
									if (typeof value[key] === 'string' && value[key].trim()) {
										return value[key].trim();
									}
								}
								// Avoid [object Object] - return null instead
								return null;
							}
							// For numbers, booleans, etc., convert to string
							return String(value).trim() || null;
						}
						
						// Handle qDef - can be string or object
						if (obj.qDef !== undefined && obj.qDef !== null) {
							const qDefStr = extractString(obj.qDef);
							if (qDefStr) return qDefStr;
						}

						if(obj.qFieldDefs !== undefined && obj.qFieldDefs !== null) {
							if(obj.qFieldDefs.length > 0) {
								return obj.qFieldsDefs.join(' ');
							}
						}
												
						const qLabelExpression = extractString(obj.qLabelExpression);
						if (qLabelExpression) return qLabelExpression;
						
						return 'N/A';
					})()}
					{@const sheetName = result.sheet || result.sheetName || 'N/A'}
					{@const sheetId = result.sheetId || result.context?.sheetId || null}
					{@const sheetUrl = result.sheetUrl || result.context?.sheetUrl || null}
					{@const chartId = result.chartId || obj?.qInfo?.qId || null}
					{@const chartTitle = result.chartTitle || result.context?.chartTitle || null}
					{@const chartUrl = result.chartUrl || result.context?.chartUrl || null}
					{@const labels = result.labels || []}
					{@const appId = result.appId || ''}
					{@const isFavorited = isFavorite(appId, result.path)}
						<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
							<td class="px-2 py-4 text-center">
								<button
									type="button"
									onclick={() => onToggleFavorite(appId, result.path)}
									class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
									title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
								>
									{#if isFavorited}
										<svg class="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
											<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
										</svg>
									{:else}
										<svg class="w-5 h-5 text-gray-400 hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
										</svg>
									{/if}
								</button>
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="flex items-start gap-2 group">
									<div class="flex-1">
										{#if labels.length > 0}
											<div class="flex flex-wrap gap-1">
												{#each labels as label}
													<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 {shouldHighlightText(label, debouncedQuery) ? 'ring-2 ring-yellow-400 dark:ring-yellow-600' : ''}" title={label}>
														{@html highlightText(label, debouncedQuery)}
													</span>
												{/each}
											</div>
										{:else}
											<span class="text-gray-400">N/A</span>
										{/if}
									</div>
									{#if labels.length > 0}
										<button
											type="button"
											onclick={() => onCopyToClipboard(labels.join(', '), getCopyId(result, 'labels'))}
											class="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
											title="Copy labels to clipboard"
										>
											{#if copiedDefinitionId === getCopyId(result, 'labels')}
												<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
											{/if}
										</button>
									{/if}
								</div>
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="flex items-start gap-2 group">
									<div class="flex-1 break-words whitespace-normal min-w-0 {shouldHighlightText(definition, debouncedQuery) ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}" title={definition}>
										{@html highlightText(definition, debouncedQuery)}
									</div>
									{#if definition !== 'N/A'}
										<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
											<button
												type="button"
												onclick={() => onCopyToClipboard(definition, getCopyId(result, 'definition'))}
												class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
												title="Copy definition to clipboard"
											>
												{#if copiedDefinitionId === getCopyId(result, 'definition')}
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
										</div>
									{/if}
								</div>
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="flex items-start gap-2 group">
									<div class="flex-1 min-w-0 {shouldHighlightText(chartTitle || '', debouncedQuery) ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}" title="{chartTitle || 'N/A'} ({chartId})">
										{#if chartTitle}
											<div class="truncate">
												{@html highlightText(chartTitle, debouncedQuery)}
											</div>
											{#if chartId}
												<div class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
													{chartId}
												</div>
											{/if}
										{:else}
											<span class="text-gray-400">N/A</span>
										{/if}
									</div>
									<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
										{#if chartTitle}
											<button
												type="button"
												onclick={() => onCopyToClipboard(chartTitle || '', getCopyId(result, 'chartTitle'))}
												class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
												title="Copy chart title to clipboard"
											>
												{#if copiedDefinitionId === getCopyId(result, 'chartTitle')}
													<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												{:else}
													<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
													</svg>
												{/if}
											</button>
										{/if}
										{#if chartUrl && chartTitle}
											<a
												href={chartUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
												title="Open chart in new window"
											>
												<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										{/if}
									</div>
								</div>
							</td>
							<td class="px-4 py-4 text-sm">
								<div class="truncate {getTypeColorClass(result.objectType)} font-medium" title={result.objectType}>{result.objectType}</div>
							</td>
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
								<div class="flex items-start gap-2 group">
									<div class="flex-1 min-w-0 {shouldHighlightText(result.app || '', debouncedQuery) ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}" title="{result.app} ({result.appId})">
										<div class="truncate">
											{@html highlightText(result.app || '', debouncedQuery)}
										</div>
										{#if result.appId}
											<div class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
												{result.appId}
											</div>
										{/if}
									</div>
									<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
										<button
											type="button"
											onclick={() => onCopyToClipboard(result.app || '', getCopyId(result, 'app'))}
											class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
											title="Copy app name to clipboard"
										>
											{#if copiedDefinitionId === getCopyId(result, 'app')}
												<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
											{/if}
										</button>
										{#if getAppUrl(result.appId)}
											<a
												href={getAppUrl(result.appId)!}
												target="_blank"
												rel="noopener noreferrer"
												class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
												title="Open app in new window"
											>
												<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										{/if}
									</div>
								</div>
							</td>
						<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
							<div class="flex items-start gap-2 group">
								<div class="flex-1 min-w-0 {shouldHighlightText(sheetName, debouncedQuery) ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}" title="{sheetName} ({sheetId})">
									<div class="truncate">
										{@html highlightText(sheetName, debouncedQuery)}
									</div>
									{#if sheetId}
										<div class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
											{sheetId}
										</div>
									{/if}
								</div>
								<div class="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100">
									{#if sheetName && sheetName !== 'N/A'}
										<button
											type="button"
											onclick={() => onCopyToClipboard(sheetName, getCopyId(result, 'sheet'))}
											class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
											title="Copy sheet name to clipboard"
										>
											{#if copiedDefinitionId === getCopyId(result, 'sheet')}
												<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
											{/if}
										</button>
									{/if}
									{#if sheetUrl && sheetName !== 'N/A'}
										<a
											href={sheetUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
											title="Open sheet in new window"
										>
											<svg class="w-4 h-4 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
											</svg>
										</a>
									{/if}
								</div>
							</div>
						</td>
						</tr>
					{/each}
				</tbody>
			</table>
			</div>
			
			{#if actualTotalPages > 1}
			{@const pageNumbers = (() => {
				const pages: (number | string)[] = [];
				if (actualTotalPages <= 7) {
					// Show all pages if 7 or fewer
					for (let i = 1; i <= actualTotalPages; i++) {
						pages.push(i);
					}
				} else {
					// Always show first page
					pages.push(1);
					
					if (currentPage <= 4) {
						// Near the start: show 1, 2, 3, 4, 5, ..., last
						for (let i = 2; i <= 5; i++) {
							pages.push(i);
						}
						pages.push('...');
						pages.push(actualTotalPages);
					} else if (currentPage >= actualTotalPages - 3) {
						// Near the end: show 1, ..., last-4, last-3, last-2, last-1, last
						pages.push('...');
						for (let i = actualTotalPages - 4; i <= actualTotalPages; i++) {
							pages.push(i);
						}
					} else {
						// In the middle: show 1, ..., current-1, current, current+1, ..., last
						pages.push('...');
						for (let i = currentPage - 1; i <= currentPage + 1; i++) {
							pages.push(i);
						}
						pages.push('...');
						pages.push(actualTotalPages);
					}
				}
				return pages;
			})()}
			<div class="flex items-center justify-between flex-shrink-0 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={handlePreviousPage}
						disabled={currentPage === 1}
						class="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Previous
					</button>
					<div class="flex items-center gap-1">
						{#each pageNumbers as pageNum}
							{#if typeof pageNum === 'number'}
								<button
									type="button"
									onclick={() => handlePageChange(pageNum)}
									class="px-3 py-1 text-sm font-medium rounded-md transition-colors {currentPage === pageNum 
										? 'bg-blue-600 text-white dark:bg-blue-500' 
										: 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}"
								>
									{pageNum}
								</button>
							{:else}
								<span class="px-2 text-gray-500 dark:text-gray-400">...</span>
							{/if}
						{/each}
					</div>
					<button
						type="button"
						onclick={handleNextPage}
						disabled={currentPage >= actualTotalPages}
						class="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Next
					</button>
				</div>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<label for="page-size-select" class="text-sm text-gray-600 dark:text-gray-400">
							Items per page:
						</label>
						<select
							id="page-size-select"
							value={itemsPerPage}
							onchange={(e) => handlePageSizeChange(Number((e.target as HTMLSelectElement).value))}
							class="pl-2 pr-8 py-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3E%3C/svg%3E')] bg-[length:1rem_1rem] bg-no-repeat bg-[right_0.5rem_center] dark:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%239ca3af%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3E%3C/svg%3E')]"
						>
							{#each pageSizeOptions as option}
								<option value={option}>{option}</option>
							{/each}
						</select>
					</div>
					<div class="text-sm text-gray-600 dark:text-gray-400">
						Showing {sortedResults.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} to {Math.min(currentPage * itemsPerPage, sortedResults.length)} of {sortedResults.length} results
					</div>
				</div>
			</div>
			{/if}
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

