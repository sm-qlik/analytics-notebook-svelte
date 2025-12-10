<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { authStore } from '$lib/stores/auth';
	import { appCache } from '$lib/stores/app-cache';
	import { loadingProgressStore } from '$lib/stores/loading-progress';
	import { loadQlikAPI, configureQlikAuthOnce } from '$lib/utils/qlik-auth';
	import {
		extractChartsFromAppStructure,
		filterDeprecatedCharts,
		type ChartInfo,
	} from '$lib/utils/chart-extraction';
	import { getAppUrl, getSheetUrl, getSpaceUrl } from '$lib/utils/url-utils';
	import LoadingIndicator from './LoadingIndicator.svelte';
	import { PERSONAL_SPACE_ID } from '$lib/utils/search-utils';

	let isLoading = $state(false);
	let deprecatedCharts = $state<ChartInfo[]>([]);
	let error = $state<string | null>(null);
	let sortColumn = $state<'app' | 'appId' | 'sheet' | 'chartTitle' | 'chartType' | 'space' | null>(null);
	let sortDirection = $state<'asc' | 'desc'>('asc');
	let spacesMap = $state<Map<string, string>>(new Map());
	let copiedId = $state<string | null>(null);

	async function loadSpaces(tenantUrl: string) {
		try {
			await configureQlikAuthOnce(tenantUrl);
			const qlikApi = await loadQlikAPI();
			
			if (!qlikApi.spaces) {
				return new Map<string, string>();
			}
			
			const { spaces: spacesApi } = qlikApi;
			const allSpacesData: any[] = [];
			let nextUrl: string | null = null;
			let pageCount = 0;
			const maxPages = 100;
			
			// First request
			let spacesResponse = await spacesApi.getSpaces({ limit: 100 });
			if (spacesResponse.status === 200) {
				allSpacesData.push(...(spacesResponse.data?.data || []));
				nextUrl = spacesResponse.data?.links?.next?.href || null;
				pageCount++;
				
				// Follow pagination links
				while (nextUrl && pageCount < maxPages) {
					try {
						const url = new URL(nextUrl, 'https://placeholder.com');
						const searchParams = new URLSearchParams(url.search);
						
						spacesResponse = await spacesApi.getSpaces({ 
							limit: 100,
							...Object.fromEntries(searchParams.entries())
						});
						
						if (spacesResponse.status !== 200) {
							break;
						}
						
						const pageSpaces = spacesResponse.data?.data || [];
						if (pageSpaces.length === 0) {
							break;
						}
						
						allSpacesData.push(...pageSpaces);
						nextUrl = spacesResponse.data?.links?.next?.href || null;
						pageCount++;
					} catch (err) {
						console.warn('Error during spaces pagination:', err);
						break;
					}
				}
			}
			
			// Create map of spaceId -> spaceName
			const map = new Map<string, string>();
			map.set(PERSONAL_SPACE_ID, 'Personal');
			
			allSpacesData.forEach((space: any) => {
				const id = space.resourceId || space.id || space.spaceId;
				const name = space.name || id || 'Unknown Space';
				if (id) {
					map.set(id, name);
				}
			});
			
			return map;
		} catch (err) {
			console.warn('Failed to load spaces:', err);
			// Return map with just Personal space
			const map = new Map<string, string>();
			map.set(PERSONAL_SPACE_ID, 'Personal');
			return map;
		}
	}

	async function findDeprecatedCharts() {
		isLoading = true;
		error = null;
		deprecatedCharts = [];

		try {
			const authState = get(authStore);
			if (!authState.isAuthenticated || !authState.tenantUrl || !authState.user?.id) {
				error = 'Not authenticated';
				isLoading = false;
				return;
			}

			const tenantUrl = authState.tenantUrl;
			const userId = authState.user.id;

			// Load spaces in parallel
			const spacesPromise = loadSpaces(tenantUrl);

			// Get all cached apps
			const cachedApps = await appCache.getAllCachedApps(tenantUrl, userId);

			if (cachedApps.length === 0) {
				error = 'No cached apps found. Please load apps first.';
				isLoading = false;
				return;
			}

			// Wait for spaces to load
			spacesMap = await spacesPromise;

			// Extract charts from all apps
			const allCharts: ChartInfo[] = [];

			for (const app of cachedApps) {
				if (app.data) {
					const spaceId = app.spaceId;
					const spaceName = spaceId ? (spacesMap.get(spaceId) || 'Unknown Space') : spacesMap.get(PERSONAL_SPACE_ID) || 'Personal';
					
					const charts = extractChartsFromAppStructure(
						app.data,
						app.id,
						app.name,
						tenantUrl,
						spaceId,
						spaceName
					);
					allCharts.push(...charts);
				}
			}

			// Filter deprecated charts
			deprecatedCharts = filterDeprecatedCharts(allCharts);
		} catch (err: any) {
			console.error('Error finding deprecated charts:', err);
			error = err.message || 'Failed to find deprecated charts';
		} finally {
			isLoading = false;
		}
	}

	function toggleSort(column: 'app' | 'appId' | 'sheet' | 'chartTitle' | 'chartType' | 'space') {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	function getSortValue(chart: ChartInfo, column: 'app' | 'appId' | 'sheet' | 'chartTitle' | 'chartType' | 'space'): string {
		switch (column) {
			case 'app':
				return chart.appName || '';
			case 'appId':
				return chart.appId || '';
			case 'sheet':
				return chart.sheetTitle || '';
			case 'chartTitle':
				return chart.chartTitle || '';
			case 'chartType':
				return chart.chartType || '';
			case 'space':
				return chart.spaceName || '';
			default:
				return '';
		}
	}

	async function copyToClipboard(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedId = id;
			setTimeout(() => {
				copiedId = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}


	const sortedCharts = $derived.by(() => {
		if (!sortColumn) {
			return deprecatedCharts;
		}
		
		return [...deprecatedCharts].sort((a, b) => {
			const aValue = getSortValue(a, sortColumn!);
			const bValue = getSortValue(b, sortColumn!);
			const comparison = aValue.localeCompare(bValue);
			return sortDirection === 'asc' ? comparison : -comparison;
		});
	});

	function getSpaceUrlForDisplay(spaceId: string | undefined, tenantUrl: string): string | null {
		if (!spaceId || spaceId === PERSONAL_SPACE_ID) return null;
		return getSpaceUrl(spaceId, tenantUrl);
	}

	onMount(() => {
		// Auto-run on mount
		findDeprecatedCharts();
		
		// Register refresh callback with loading progress store
		loadingProgressStore.setCallbacks({
			onRefreshChartFinder: findDeprecatedCharts
		});
		
		return () => {
			// Cleanup: remove callback when component unmounts
			loadingProgressStore.setCallbacks({
				onRefreshChartFinder: undefined
			});
		};
	});
</script>

<div class="w-full">
	<div class="mb-4">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
			Deprecated Chart Finder
		</h2>
		<p class="text-sm text-gray-600 dark:text-gray-400">
			Finds all charts that use deprecated chart types (qlik-button-for-navigation, qlik-show-hide-container, qlik-share-button, qlik-tabbed-container, qlik-heatmap-chart, qlik-multi-kpi, qlik-bullet-chart, qlik-barplus-chart) across all cached apps.
		</p>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-8">
			<div class="text-center">
				<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
				<p class="mt-4 text-sm text-gray-600 dark:text-gray-400">Searching for deprecated charts...</p>
			</div>
		</div>
	{:else if error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
			<p class="text-red-800 dark:text-red-200">{error}</p>
		</div>
	{:else if deprecatedCharts.length === 0}
		<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
			<p class="text-green-800 dark:text-green-200">
				No deprecated charts found! All charts are using current chart types.
			</p>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
			<div class="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300">
					Found {deprecatedCharts.length} deprecated chart{deprecatedCharts.length !== 1 ? 's' : ''}
				</p>
			</div>
			<div class="overflow-hidden min-w-0 relative">
				<div class="overflow-x-auto">
					<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 min-w-0">
						<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
							<tr>
								<th
									class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
									onclick={() => toggleSort('space')}
									title="Click to sort"
								>
								<div class="flex items-center gap-1">
									Space
									{#if sortColumn === 'space'}
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
								class="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
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
								class="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
								onclick={() => toggleSort('appId')}
								title="Click to sort"
							>
								<div class="flex items-center gap-1">
									App ID
									{#if sortColumn === 'appId'}
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
							<th
								class="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
								onclick={() => toggleSort('chartTitle')}
								title="Click to sort"
							>
								<div class="flex items-center gap-1">
									Chart Title
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
								class="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 select-none"
								onclick={() => toggleSort('chartType')}
								title="Click to sort"
							>
								<div class="flex items-center gap-1">
									Chart Type
									{#if sortColumn === 'chartType'}
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
						{#each sortedCharts as chart}
							{@const authState = get(authStore)}
							{@const tenantUrl = authState.tenantUrl || ''}
							{@const spaceUrl = getSpaceUrlForDisplay(chart.spaceId, tenantUrl)}
							{@const appUrl = getAppUrl(chart.appId, tenantUrl)}
							{@const sheetUrl = getSheetUrl(chart.sheetId, chart.appId, tenantUrl)}
							{@const spaceCopyId = `space-${chart.chartId}`}
							{@const appCopyId = `app-${chart.chartId}`}
							{@const appIdCopyId = `appId-${chart.chartId}`}
							{@const sheetCopyId = `sheet-${chart.chartId}`}
							{@const chartTitleCopyId = `chartTitle-${chart.chartId}`}
							{@const chartTypeCopyId = `chartType-${chart.chartId}`}
							<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
								<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 group">
									<div class="flex items-center justify-between gap-2 min-w-0">
										<span class="truncate">{chart.spaceName || 'Personal'}</span>
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												type="button"
												onclick={() => copyToClipboard(chart.spaceName || 'Personal', spaceCopyId)}
												class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
												title="Copy space name"
											>
												{#if copiedId === spaceCopyId}
													<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												{:else}
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
													</svg>
												{/if}
											</button>
											{#if spaceUrl}
												<a
													href={spaceUrl}
													target="_blank"
													rel="noopener noreferrer"
													class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
													title="Open space"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
													</svg>
												</a>
											{/if}
										</div>
									</div>
								</td>
								<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 group">
									<div class="flex items-center justify-between gap-2 min-w-0">
										<span class="truncate">{chart.appName}</span>
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												type="button"
												onclick={() => copyToClipboard(chart.appName, appCopyId)}
												class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
												title="Copy app name"
											>
												{#if copiedId === appCopyId}
													<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												{:else}
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
													</svg>
												{/if}
											</button>
											<a
												href={appUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
												title="Open app"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										</div>
									</div>
								</td>
								<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 group">
									<div class="flex items-center justify-between gap-2 min-w-0">
										<span class="font-mono text-xs truncate">{chart.appId}</span>
										<button
											type="button"
											onclick={() => copyToClipboard(chart.appId, appIdCopyId)}
											class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
											title="Copy app ID"
										>
											{#if copiedId === appIdCopyId}
												<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
											{/if}
										</button>
									</div>
								</td>
								<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 group">
									<div class="flex items-center justify-between gap-2 min-w-0">
										<span class="truncate">{chart.sheetTitle}</span>
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												type="button"
												onclick={() => copyToClipboard(chart.sheetTitle, sheetCopyId)}
												class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
												title="Copy sheet name"
											>
												{#if copiedId === sheetCopyId}
													<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
													</svg>
												{:else}
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
													</svg>
												{/if}
											</button>
											<a
												href={sheetUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
												title="Open sheet"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										</div>
									</div>
								</td>
								<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 group">
									<div class="flex items-center justify-between gap-2 min-w-0">
										{#if chart.chartTitle}
											<span class="truncate">{chart.chartTitle}</span>
										{:else}
											<span class="text-gray-400 italic truncate">Untitled</span>
										{/if}
										<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											{#if chart.chartTitle}
												<button
													type="button"
													onclick={() => copyToClipboard(chart.chartTitle || '', chartTitleCopyId)}
													class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
													title="Copy chart title"
												>
													{#if copiedId === chartTitleCopyId}
														<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
														</svg>
													{:else}
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
														</svg>
													{/if}
												</button>
											{/if}
											<a
												href={chart.chartUrl}
												target="_blank"
												rel="noopener noreferrer"
												class="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
												title="Open chart"
											>
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
												</svg>
											</a>
										</div>
									</div>
								</td>
								<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100 group">
									<div class="flex items-center justify-between gap-2 min-w-0">
										<span
											class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 truncate"
										>
											{chart.chartType}
										</span>
										<button
											type="button"
											onclick={() => copyToClipboard(chart.chartType, chartTypeCopyId)}
											class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
											title="Copy chart type"
										>
											{#if copiedId === chartTypeCopyId}
												<svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
											{:else}
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
												</svg>
											{/if}
										</button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				</div>
			</div>
		</div>
	{/if}
</div>

