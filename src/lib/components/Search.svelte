<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, configureQlikAuthOnce, resetAuthConfiguration } from '$lib/utils/qlik-auth';
	import { EngineInterface } from '$lib/utils/engine-interface';
	import Fuse from 'fuse.js';
	import * as XLSX from 'xlsx';
	import FilterSidebar from './FilterSidebar.svelte';
	import SearchInput from './SearchInput.svelte';
	import SearchResultsTable from './SearchResultsTable.svelte';
	import type { SearchResultItem } from '$lib/utils/search-result-item';
	import LoadingIndicator from './LoadingIndicator.svelte';
	import CompletionIndicator from './CompletionIndicator.svelte';
	import { extractObjects } from '$lib/utils/extract-objects';
	import { extractLabels, extractSearchableFields } from '$lib/utils/search-utils';

	let searchQuery = $state('');	
	let searchResults = $state([] as Array<SearchResultItem>);
	let unfilteredResults = $state([] as Array<SearchResultItem>);
	let isSearching = $state(false);
	let isLoadingApps = $state(false);
	let isLoadingAppData = $state(false);
	let dataLoadError = $state<string | null>(null);
	let loadingProgress = $state({ current: 0, total: 0, currentApp: '' });
	
	let qlikApps = $state<Array<{ id: string; name: string; data: any }>>([]);
	let apps = $state<Array<{ name: string; id: string; spaceId?: string }>>([]);
	let appItems = $state<Array<{ resourceId: string; name: string; spaceId?: string }>>([]);
	let spaces = $state<Array<{ name: string; id: string }>>([]);
	let sheets = $state<Array<{ name: string; app: string; appId: string; sheetId: string; approved?: boolean; published?: boolean }>>([]);
	let sheetMetadata = $state<Map<string, { approved: boolean; published: boolean }>>(new Map());
	let loadingAppIds = $state<Set<string>>(new Set());
	
	// Mutex for serializing sheet metadata updates to prevent race conditions
	let metadataUpdateQueue: Promise<void> = Promise.resolve();
	let currentTenantHostname = $state('');
	let currentTenantUrl = $state<string | null>(null);
	let hasNewDataPending = $state(false);
	let lastRefreshedAppsCount = $state(0);
	let isAuthConfigured = $state(false);
	let isSidebarCollapsed = $state(false);
	let currentPage = $state(1);
	const itemsPerPage = 20;
	
	function createNewSet(oldSet: Set<string>): Set<string> {
		return new Set(oldSet);
	}
	
	// Pagination is now handled in SearchResultsTable component
	
	const totalPages = $derived(Math.ceil(searchResults.length / itemsPerPage));
	
	function goToPage(page: number) {
		// Page validation is handled by SearchResultsTable component
		currentPage = page;
	}
	
	function goToNextPage() {
		// Page validation is handled by SearchResultsTable component
		currentPage++;
	}
	
	function goToPreviousPage() {
		// Page validation is handled by SearchResultsTable component
		if (currentPage > 1) {
			currentPage--;
		}
	}

	function getSheetNameFromId(sheetId: string | null): string | null {
		if (!sheetId) return null;
		const currentSheets = sheets;
		const sheet = currentSheets.find(s => s.sheetId === sheetId);
		return sheet ? sheet.name : null;
	}

	function getSheetState(sheetId: string | null): 'Public' | 'Community' | 'Private' | null {
		if (!sheetId) return null;
		const metadata = sheetMetadata.get(sheetId);
		if (!metadata) {
			// Fallback to sheet object if metadata not found
			const sheet = sheets.find(s => s.sheetId === sheetId);
			if (sheet) {
				const approved = sheet.approved ?? false;
				const published = sheet.published ?? false;
				if (approved) return 'Public';
				if (published) return 'Community';
				return 'Private';
			}
			return null;
		}
		if (metadata.approved) return 'Public';
		if (metadata.published) return 'Community';
		return 'Private';
	}

	/**
	 * Extracts sheet metadata (approved and published status) from an array of sheets.
	 * @param sheets - Array of sheet objects from structureData
	 * @returns Map of sheetId to metadata object
	 */
	function extractSheetMetadata(sheets: any[]): Map<string, { approved: boolean; published: boolean }> {
		const metadata = new Map<string, { approved: boolean; published: boolean }>();
		sheets.forEach((sheet: any) => {
			const sheetId = sheet?.qProperty?.qInfo?.qId || '';
			if (sheetId) {
				const approved = !!sheet.approved;
				const published = !!sheet.published;
				metadata.set(sheetId, { approved, published });
			}
		});
		return metadata;
	}

	/**
	 * Extracts sheet objects from structureData for a given app.
	 * @param sheets - Array of sheet objects from structureData
	 * @param appName - Name of the app
	 * @param appId - ID of the app
	 * @returns Array of sheet objects with name, app, appId, sheetId, approved, and published
	 */
	function extractSheetObjects(
		sheets: any[],
		appName: string,
		appId: string
	): Array<{ name: string; app: string; appId: string; sheetId: string; approved?: boolean; published?: boolean }> {
		const newSheets: Array<{ name: string; app: string; appId: string; sheetId: string; approved?: boolean; published?: boolean }> = [];
		sheets.forEach((sheet: any) => {
			const sheetTitle = sheet?.qProperty?.qMetaDef?.title;
			const sheetId = sheet?.qProperty?.qInfo?.qId || '';
			if (sheetTitle && sheetId) {
				const approved = !!sheet.approved;
				const published = !!sheet.published;
				newSheets.push({
					name: sheetTitle,
					app: appName,
					appId: appId,
					sheetId: sheetId,
					approved,
					published
				});
			}
		});
		return newSheets;
	}

	/**
	 * Atomically merges new sheet metadata into the existing metadata map.
	 * Uses a promise queue to serialize updates and prevent race conditions.
	 * @param newMetadata - Map of new metadata to merge
	 * @returns Promise that resolves when the update is complete
	 */
	async function updateSheetMetadata(
		newMetadata: Map<string, { approved: boolean; published: boolean }>
	): Promise<void> {
		// Queue this update to run after all previous updates complete
		const previousUpdate = metadataUpdateQueue;
		let resolveUpdate: () => void;
		const thisUpdate = new Promise<void>((resolve) => {
			resolveUpdate = resolve;
		});
		
		metadataUpdateQueue = previousUpdate.then(async () => {
			// Read the latest state right before updating (atomic read)
			const currentMetadata = new Map(sheetMetadata);
			// Merge new metadata into the copy
			newMetadata.forEach((value, key) => {
				currentMetadata.set(key, value);
			});
			// Atomically update the state
			sheetMetadata = currentMetadata;
			// Resolve this update's promise
			resolveUpdate!();
		});
		
		// Wait for this update to complete
		await thisUpdate;
	}

	/**
	 * Processes sheets from structureData: extracts sheet objects and updates metadata.
	 * @param structureData - Structure data containing sheets array
	 * @param appName - Name of the app
	 * @param appId - ID of the app
	 */
	async function processSheets(structureData: any, appName: string, appId: string): Promise<void> {
		if (!structureData.sheets || !Array.isArray(structureData.sheets)) {
			return;
		}

		// Extract and add sheet objects
		const newSheets = extractSheetObjects(structureData.sheets, appName, appId);
		sheets = [...sheets, ...newSheets];

		// Extract and atomically merge metadata (serialized via promise queue)
		const newMetadata = extractSheetMetadata(structureData.sheets);
		await updateSheetMetadata(newMetadata);
	}

	const availableSheets = $derived.by(() => {
		const seen = new Set<string>();
		const hasAppSelection = selectedApps.size > 0;
		return sheets
			.filter((sheet) => loadedAppIds.has(sheet.appId))
			.filter((sheet) => !hasAppSelection || selectedApps.has(sheet.appId))
			.filter((sheet) => {
				// Deduplicate by sheetId only (ignore appId for display purposes)
				if (seen.has(sheet.sheetId)) return false;
				seen.add(sheet.sheetId);
				return true;
			})
			.map((sheet) => ({ name: sheet.name, id: sheet.sheetId, appId: sheet.appId }))
			.sort((a, b) => a.name.localeCompare(b.name));
	});
	
	// Special ID for "Personal" space (apps with no spaceId)
	const PERSONAL_SPACE_ID = '__personal__';
	
	const availableSpaces = $derived.by(() => {
		const sortedSpaces = [...spaces].sort((a, b) => a.name.localeCompare(b.name));
		// Always add "Personal" at the top for apps without a spaceId
		return [{ name: 'Personal', id: PERSONAL_SPACE_ID }, ...sortedSpaces];
	});
	
	const availableApps = $derived(
		apps
			.filter((app) => {
				if (selectedSpaces.size === 0) return true;
				// Check if "Personal" is selected - match apps with no spaceId
				const personalSelected = selectedSpaces.has(PERSONAL_SPACE_ID);
				const appHasNoSpace = !app.spaceId;
				if (personalSelected && appHasNoSpace) return true;
				// Check if app's space is selected
				return app.spaceId && selectedSpaces.has(app.spaceId);
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	
	let selectedSpaces = $state(new Set<string>());
	let selectedApps = $state(new Set<string>());
	let selectedSheets = $state(new Set<string>());
	let selectedTypes = $state(new Set<string>());
	let selectedSheetStates = $state(new Set<string>());
	
	// Track which apps have been loaded (have data)
	const loadedAppIds = $derived(new Set(qlikApps.map(a => a.id)));
	
	type SearchableItem = {
		path: string;
		object: any;
		objectType: string | null;
		context: any;
		file: string;
		app: string;
		appId: string;
		sheet: string | null;
		sheetName: string | null;
		sheetId: string | null;
		sheetUrl: string | null;
		chartId: string | null;
		chartTitle: string | null;
		chartUrl: string | null;
		searchableText: string;
		labels: string[];
		title: string;
	};

	let searchableIndex: SearchableItem[] = $state([]);
	let fuseInstance: Fuse<SearchableItem> | null = $state(null);
	
	const availableTypes = $derived(
		Array.from(new Set(searchableIndex.map((r) => r.objectType).filter((t): t is string => Boolean(t)))).sort()
	);

    // extractSearchableFields moved to $lib/utils/search-utils

    // extractLabels moved to $lib/utils/search-utils

	function buildSearchableIndex() {
		if (qlikApps.length === 0) {
			searchableIndex = [];
			fuseInstance = null;
			return;
		}
		
		const index: SearchableItem[] = [];
		const processedObjects = new Map<string, boolean>();
		function indexPush(item: any) { index.push(item); }

		qlikApps.forEach((appData) => {
			const { id: appId, name: appName, data } = appData;
			
			const appStructure = {
				appLayout: data.appLayout,
				masterDimensions: data.masterDimensions || [],
				masterMeasures: data.masterMeasures || [],
				sheets: data.sheets || [],
				sheetDimensions: data.sheetDimensions || [],
				sheetMeasures: data.sheetMeasures || []
			};
			
			appStructure.masterDimensions.forEach((dim: any, idx: number) => {
				if (dim.qDim) {
					extractObjects(
						dim.qDim,
						`masterDimensions[${idx}].qDim`,
						{ appName, appId, inMasterDimensions: true, inQdim: true },
						appId,
						appName,
						dim,
						getSheetNameFromId,
						processedObjects,
						indexPush
				);
			}
			});
			
			appStructure.masterMeasures.forEach((measure: any, idx: number) => {
				if (measure.qMeasure) {
					extractObjects(
						measure.qMeasure,
						`masterMeasures[${idx}].qMeasure`,
						{ appName, appId, inMasterMeasures: true, inQmeasure: true },
						appId,
						appName,
						measure,
						getSheetNameFromId,
						processedObjects,
						indexPush
				);
			}
			});
			
			appStructure.sheetDimensions.forEach((dim: any, idx: number) => {
				const sheetId = dim.sheetId;
				const sheetName = dim.sheetTitle || getSheetNameFromId(sheetId) || null;
				const sheetUrl = dim.sheetUrl || null;
				const chartTitle = dim.chartTitle || null;
				const chartUrl = dim.chartUrl || null;
				
				if (dim.qDef) {
					// For inline dimensions, find the library reference if it exists for label extraction
					let libraryDimForLabels = null;
					if (dim.qLibraryId) {
						libraryDimForLabels = appStructure.masterDimensions.find((d: any) => d.qInfo?.qId === dim.qLibraryId);
					}
					// Pass the library dimension as parentObj so we can extract labels from it
					extractObjects(
						dim.qDef,
						`sheetDimensions[${idx}].qDef`,
						{
							appName,
							appId,
							inSheetDimensions: true,
							inQdim: true,
							sheetId,
							sheetName,
							sheetUrl,
							chartTitle,
							chartUrl
						},
						appId,
						appName,
						libraryDimForLabels || dim, // Use library dim if available for label extraction
					getSheetNameFromId,
					processedObjects,
					indexPush
					);
				} else if (dim.qLibraryId) {
					// Library dimension reference - look up from master dimensions
					const libraryDim = appStructure.masterDimensions.find((d: any) => d.qInfo?.qId === dim.qLibraryId);
					if (libraryDim?.qDim) {
						extractObjects(
							libraryDim.qDim,
							`sheetDimensions[${idx}].qDef`,
							{
								appName,
								appId,
								inSheetDimensions: true,
								inQdim: true,
								sheetId,
								sheetName,
								sheetUrl,
								chartTitle,
								chartUrl
							},
							appId,
							appName,
							libraryDim, // Pass the full library dimension object
							getSheetNameFromId,
							processedObjects,
							indexPush						
						);
					}
				}
			});
			
			appStructure.sheetMeasures.forEach((measure: any, idx: number) => {
				const sheetId = measure.sheetId;
				const sheetName = measure.sheetTitle || getSheetNameFromId(sheetId) || null;
				const sheetUrl = measure.sheetUrl || null;
				const chartTitle = measure.chartTitle || null;
				const chartUrl = measure.chartUrl || null;
				
				if (measure.qDef) {
					// For inline measures, find the library reference if it exists for label extraction
					let libraryMeasureForLabels = null;
					if (measure.qLibraryId) {
						libraryMeasureForLabels = appStructure.masterMeasures.find((m: any) => m.qInfo?.qId === measure.qLibraryId);
					}
					// Pass the library measure as parentObj so we can extract labels from it
					extractObjects(
						measure.qDef,
						`sheetMeasures[${idx}].qDef`,
						{
							appName,
							appId,
							inSheetMeasures: true,
							inQmeasure: true,
							sheetId,
							sheetName,
							sheetUrl,
							chartTitle,
							chartUrl
						},
						appId,
						appName,
						libraryMeasureForLabels || measure, // Use library measure if available for label extraction
						getSheetNameFromId,
						processedObjects,
						indexPush
					);
				} else if (measure.qLibraryId) {
					// Library measure reference - look up from master measures
					const libraryMeasure = appStructure.masterMeasures.find((m: any) => m.qInfo?.qId === measure.qLibraryId);
					if (libraryMeasure?.qMeasure) {
						extractObjects(
							libraryMeasure.qMeasure,
							`sheetMeasures[${idx}].qDef`,
							{
								appName,
								appId,
								inSheetMeasures: true,
								inQmeasure: true,
								sheetId,
								sheetName,
								sheetUrl,
								chartTitle,
								chartUrl
							},
							appId,
							appName,
							libraryMeasure, // Pass the full library measure object
							getSheetNameFromId,
							processedObjects,
							indexPush
						);
					}
				}
			});
		});

		searchableIndex = index;

		// Create searchable labels string for Fuse.js full-text search
		const indexWithLabelsString = index.map(item => ({
			...item,
			labelsString: item.labels.join(' ')
		}));
		
		fuseInstance = new Fuse(indexWithLabelsString, {
			keys: [
				{ name: 'title', weight: 0.5 },
				{ name: 'labelsString', weight: 0.4 },
				{ name: 'searchableText', weight: 0.3 },
				{ name: 'app', weight: 0.1 },
				{ name: 'sheetName', weight: 0.08 },
				{ name: 'chartTitle', weight: 0.08 },
				{ name: 'objectType', weight: 0.05 }
			],
			threshold: 0.3,
			includeScore: true,
			minMatchCharLength: 1,
			ignoreLocation: true,
			findAllMatches: true
		});
		
		// Update searchableIndex to use the version with labelsString
		searchableIndex = indexWithLabelsString;
		
		// Don't automatically trigger search here - let the effect handle it
		// This prevents loops when apps are loading
	}

	// Configure Qlik API auth once - returns the API module
	async function ensureAuthConfigured(): Promise<{ qlikApi: any; tenantUrl: string }> {
		const authState = authStore;
		let currentAuthState: any = null;
		const unsubscribe = authState.subscribe(state => {
			currentAuthState = state;
		});
		unsubscribe();
		
		if (!currentAuthState?.isAuthenticated || !currentAuthState?.tenantUrl) {
			throw new Error('Not authenticated');
		}
		
		const tenantUrl = currentAuthState.tenantUrl;
		
		// Configure auth once per tenant (prevents multiple setDefaultHostConfig calls)
		await configureQlikAuthOnce(tenantUrl);
		
		const qlikApi = await loadQlikAPI();
		isAuthConfigured = true;
		
		return { qlikApi, tenantUrl };
	}
	

	async function loadSpaces() {
		try {
			const { qlikApi } = await ensureAuthConfigured();
			
			if (!qlikApi.spaces) {
				spaces = [];
				return;
			}
			
		const { spaces: spacesApi } = qlikApi;
		
		const spacesResponse = await spacesApi.getSpaces({ limit: 100 });
		if (spacesResponse.status !== 200) {
			throw new Error(`Failed to get spaces: ${spacesResponse.status}`);
		}
			
			const allSpaces = spacesResponse.data?.data || [];
			spaces = allSpaces
				.map((space: any, index: number) => {
					const id = space.resourceId || space.id || space.spaceId || `space-${index}`;
					return {
						name: space.name || space.resourceId || space.id || `Space ${index + 1}`,
						id: id
					};
				})
				.filter((space: any) => space.id && space.id !== 'undefined');
		} catch (err: any) {
			console.error('Failed to load spaces:', err);
			// Don't throw - spaces might not be available in all tenants
			spaces = [];
		}
	}

	async function loadAppList() {
		if (isLoadingApps || appItems.length > 0) return;
		
		isLoadingApps = true;
		dataLoadError = null;
		
		try {
			const { qlikApi } = await ensureAuthConfigured();
			const { items } = qlikApi;
			
			// Load spaces in parallel with apps (don't await to avoid blocking)
			loadSpaces().catch(err => {
				// Spaces are optional, so we don't throw - just leave spaces array empty
			});
			
			const itemsResponse = await items.getItems({ resourceType: 'app[directQuery,]', limit: 100 });
			if (itemsResponse.status !== 200) {
				throw new Error(`Failed to get items: ${itemsResponse.status}`);
			}
			
			const allApps = itemsResponse.data?.data || [];
			appItems = allApps;
			apps = allApps.map((app: any) => ({
				name: app.name || app.resourceId,
				id: app.resourceId,
				spaceId: app.spaceId || app.space?.resourceId || undefined
			}));
			
			loadAppDataInBackground();
			
		} catch (err: any) {
			console.error('Failed to load app list:', err);
			dataLoadError = err.message || 'Failed to load apps from Qlik tenant';
		} finally {
			isLoadingApps = false;
		}
	}
	
	async function loadAppDataInBackground() {
		if (isLoadingAppData || appItems.length === 0) return;
		
		isLoadingAppData = true;
		loadingProgress = { current: qlikApps.length, total: appItems.length, currentApp: '' };
		
		try {
			const { qlikApi, tenantUrl } = await ensureAuthConfigured();
			const { qix } = qlikApi;
			
			const loadedAppIds = new Set(qlikApps.map(a => a.id));
			const appsToLoad = appItems.filter(app => !loadedAppIds.has(app.resourceId));
			
			if (appsToLoad.length === 0) {
				isLoadingAppData = false;
				loadingProgress = { current: appItems.length, total: appItems.length, currentApp: '' };
				return;
			}
			
			const CONCURRENCY_LIMIT = 5;
			
			async function processApp(appItem: any): Promise<void> {
				const appId = appItem.resourceId;
				const appName = appItem.name || appItem.resourceId;
				
				if (loadingAppIds.has(appId)) return;
				
				loadingAppIds = new Set([...loadingAppIds, appId]);
				loadingProgress = { 
					current: qlikApps.length, 
					total: appItems.length, 
					currentApp: appName 
				};
				
				let session: any = null;
				
				try {
					// Open app session without loading data
					session = await qix.openAppSession({ appId, withoutData: true });
					
					// Get the app document from the session
					const app = await session.getDoc();
					const structureData = await EngineInterface.fetchAppStructureData(app, tenantUrl, appId);
										
					const updatedApps = [...qlikApps, {
						id: appId,
						name: appName,
						data: structureData
					}];
					qlikApps = updatedApps;
					
					await processSheets(structureData, appName, appId);
					// Build index but don't trigger search - let the effect handle it
					buildSearchableIndex();
					// Trigger incremental search for this new app's data
					if (qlikApps.length > 0) {
						// Use untrack to prevent reactive loops
						untrack(() => {
							performSearch(true);
						});
					}
				} catch (err: any) {
					console.warn(`Failed to load app ${appName}:`, err);
				} finally {
					// Close the session immediately after loading data to free up websocket connections
					if (session) {
						try {
							await session.close();
						} catch (closeErr) {
							console.warn(`Failed to close session for ${appName}:`, closeErr);
						}
					}
					const newLoadingIds = new Set(loadingAppIds);
					newLoadingIds.delete(appId);
					loadingAppIds = newLoadingIds;
					loadingProgress = { 
						current: qlikApps.length, 
						total: appItems.length, 
						currentApp: '' 
					};
				}
			}
			
			for (let i = 0; i < appsToLoad.length; i += CONCURRENCY_LIMIT) {
				const batch = appsToLoad.slice(i, i + CONCURRENCY_LIMIT);
				await Promise.all(batch.map((appItem: any) => processApp(appItem)));
			}
			
		} catch (err: any) {
			console.error('Failed to load app data:', err);
		} finally {
			isLoadingAppData = false;
			// Ensure progress reflects actual loaded apps
			loadingProgress = { 
				current: qlikApps.length, 
				total: appItems.length, 
				currentApp: '' 
			};
		}
	}
	
	async function loadAppDataPriority(appId: string) {
		const appItem = appItems.find(a => a.resourceId === appId);
		if (!appItem) return;
		
		if (qlikApps.find(a => a.id === appId)) return;
		if (loadingAppIds.has(appId)) return;
		
		let session: any = null;
		
		try {
			const { qlikApi, tenantUrl } = await ensureAuthConfigured();
			const { qix } = qlikApi;
			
			const appName = appItem.name || appId;
			loadingAppIds = new Set([...loadingAppIds, appId]);
			loadingProgress = { 
				current: qlikApps.length, 
				total: appItems.length, 
				currentApp: appName 
			};
			
			// Open app session without loading data
			session = await qix.openAppSession({ appId, withoutData: true });
			
			// Get the app document from the session
			const app = await session.getDoc();
			const structureData = await EngineInterface.fetchAppStructureData(app, tenantUrl, appId);
			
			qlikApps = [...qlikApps, { id: appId, name: appName, data: structureData }];
			
			await processSheets(structureData, appName, appId);
			buildSearchableIndex();
			
			loadAppDataInBackground();
			
		} catch (err: any) {
			console.warn(`Failed to load app ${appId}:`, err);
		} finally {
			// Close the session immediately after loading data to free up websocket connections
			if (session) {
				try {
					await session.close();
				} catch (closeErr) {
					console.warn(`Failed to close session for ${appId}:`, closeErr);
				}
			}
			const newLoadingIds = new Set(loadingAppIds);
			newLoadingIds.delete(appId);
			loadingAppIds = newLoadingIds;
			loadingProgress = { 
				current: qlikApps.length, 
				total: appItems.length, 
				currentApp: '' 
			};
		}
	}
	
	async function refreshData() {
		qlikApps = [];
		apps = [];
		appItems = [];
		sheets = [];
		searchableIndex = [];
		fuseInstance = null;
		loadingAppIds = new Set();
		loadingProgress = { current: 0, total: 0, currentApp: '' };
		hasNewDataPending = false;
		lastRefreshedAppsCount = 0;
		// Note: We don't reset isAuthConfigured as the same auth session can be reused
		
		selectedSpaces = new Set();
		selectedApps = new Set();
		selectedSheets = new Set();
		selectedTypes = new Set();
		selectedSheetStates = new Set();
		sheetMetadata = new Map();
		// Reset the metadata update queue to prevent stale updates from overwriting fresh state
		metadataUpdateQueue = Promise.resolve();
		
		await loadAppList();
	}
	
	onMount(() => {
		let previousTenantUrl = '';
		const unsubscribe = authStore.subscribe(state => {
			// Extract hostname from tenant URL for keying purposes
			if (state.tenantUrl) {
				currentTenantUrl = state.tenantUrl;
				try {
					const url = new URL(state.tenantUrl);
					currentTenantHostname = url.hostname;
				} catch {
					currentTenantHostname = state.tenantUrl;
				}
				
				// Reset auth config if tenant URL changed
				if (previousTenantUrl && previousTenantUrl !== state.tenantUrl) {
					isAuthConfigured = false;
					// Reset auth configuration to allow reconfiguration for new tenant
					resetAuthConfiguration();
				}
				previousTenantUrl = state.tenantUrl;
			} else {
				currentTenantUrl = null;
				currentTenantHostname = '';
				// Reset auth config if logged out
				isAuthConfigured = false;
			}
			
			if (state.isAuthenticated && appItems.length === 0 && !isLoadingApps) {
				loadAppList();
			}
		});
		return unsubscribe;
	});

	function performSearch(incremental: boolean = false) {
		// Only show searching spinner if:
		// 1. Not incremental (user changed search/filters) - always show spinner
		// 2. Incremental but no results yet - show spinner until we have results
		// This prevents the table from flashing during incremental updates when results already exist
		if (!incremental) {
			isSearching = true;
		} else if (searchResults.length === 0) {
			// Only show spinner during incremental if we don't have results yet
			isSearching = true;
		}
		// If incremental and we already have results, keep isSearching as is (don't change it)
		
		const query = searchQuery.trim();
		const hasQuery = query.length > 0;
		
		const hasSpaceSelections = selectedSpaces.size > 0;
		const hasAppSelections = selectedApps.size > 0;
		const hasSheetSelections = selectedSheets.size > 0;
		const hasTypeSelections = selectedTypes.size > 0;
		const hasSheetStateSelections = selectedSheetStates.size > 0;
		
		// Check if all items are selected (compare against total counts, not filtered available items)
		// Add 1 for the Personal space
		const allSpacesSelected = hasSpaceSelections && selectedSpaces.size === (spaces.length + 1);
		// For apps, compare against the total apps list, not filtered availableApps
		const allAppsSelected = hasAppSelections && selectedApps.size === apps.length;
		const allSheetsSelected = hasSheetSelections && availableSheets.length > 0 && selectedSheets.size >= availableSheets.length;
		const allTypesSelected = hasTypeSelections && selectedTypes.size === typeOptions.length;
		const allSheetStatesSelected = hasSheetStateSelections && selectedSheetStates.size === 3; // Public, Community, Private
		
		const hasSpaceFilters = hasSpaceSelections && !allSpacesSelected;
		const hasAppFilters = hasAppSelections && !allAppsSelected;
		const hasSheetFilters = hasSheetSelections && (!hasAppSelections || !allSheetsSelected);
		const hasTypeFilters = hasTypeSelections && !allTypesSelected;
		const hasSheetStateFilters = hasSheetStateSelections && !allSheetStatesSelected;
		
		const hasAnySelections = hasSpaceSelections || hasAppSelections || hasSheetSelections || hasTypeSelections || hasSheetStateSelections;
		
		// Debug: log filter state
		if (hasAppSelections) {
			console.log('App filter debug:', {
				selectedApps: Array.from(selectedApps),
				hasAppSelections,
				allAppsSelected,
				hasAppFilters,
				appsLength: apps.length,
				availableAppsLength: availableApps.length
			});
		}

		if (!hasQuery && !hasAnySelections && qlikApps.length === 0) {
			searchResults = [];
			unfilteredResults = [];
			isSearching = false;
			return;
		}

		let candidateResults: SearchableItem[] = [];
		if (hasQuery && fuseInstance) {
			const fuseResults = fuseInstance.search(query);
			candidateResults = fuseResults.map(result => result.item);
		} else {
			candidateResults = searchableIndex;
		}
		
		// When incrementally loading, append to existing results instead of clearing
		// Only clear when user explicitly changes search/filters
		const allResults: typeof searchResults = incremental ? [...searchResults] : [];
		if (!incremental) {
			unfilteredResults = [];
		}
		
		// Track existing paths to avoid duplicates when appending incrementally
		// Use appId:path as the key since paths are only unique within an app
		const existingPaths = incremental ? new Set(searchResults.map(r => `${r.appId}:${r.path}`)) : new Set();
		
		for (const item of candidateResults) {
			const sheetName = item.sheetName || item.sheet;
			
			// Skip if already in results (when appending incrementally)
			// Use appId:path to match the deduplication logic used when building the index
			if (incremental && existingPaths.has(`${item.appId}:${item.path}`)) {
				continue;
			}
			
			// Filter by space first (if space filter is active)
			if (hasSpaceFilters) {
				const app = apps.find(a => a.id === item.appId);
				if (!app) {
					continue;
				}
				// Check if "Personal" is selected and app has no space
				const personalSelected = selectedSpaces.has(PERSONAL_SPACE_ID);
				const appHasNoSpace = !app.spaceId;
				// Only allow apps through the space filter if "Personal" is selected and app has no space,
				// otherwise skip if the app's space is not selected
				if (!(personalSelected && appHasNoSpace) && (!app.spaceId || !selectedSpaces.has(app.spaceId))) {
					continue;
				}
			}

			if (hasAppFilters && !selectedApps.has(item.appId)) {
				continue;
			}

			if (hasSheetFilters) {
				if (!item.sheetId) {
					continue;
				}
				if (!selectedSheets.has(item.sheetId)) {
					continue;
				}
			}

			if (hasTypeFilters) {
				if (!item.objectType) {
					continue;
				}
				if (!selectedTypes.has(item.objectType)) {
					continue;
				}
			}

			if (hasSheetStateFilters) {
				const sheetState = getSheetState(item.sheetId);
				if (!sheetState || !selectedSheetStates.has(sheetState)) {
					continue;
				}
			}

			// Add to unfilteredResults (only if not incremental or not already present)
			// Use appId:path to match the deduplication logic used when building the index
			if (!incremental || !unfilteredResults.find(r => r.appId === item.appId && r.path === item.path)) {
				unfilteredResults.push({
					path: item.path,
					object: item.object,
					objectType: item.objectType,
					context: item.context,
					file: item.file,
					app: item.app,
					appId: item.appId,
					sheet: sheetName,
					sheetName: sheetName,
					sheetId: item.sheetId || null,
					sheetUrl: item.sheetUrl || null,
					chartId: item.chartId || null,
					chartTitle: item.chartTitle || null,
					chartUrl: item.chartUrl || null,
					labels: item.labels || []
				});
			}

		allResults.push({
			path: item.path,
			object: item.object,
			objectType: item.objectType,
			context: item.context,
			file: item.file,
			app: item.app,
			appId: item.appId,
			sheet: sheetName,
			sheetName: sheetName,
			sheetId: item.sheetId || null,
			sheetUrl: item.sheetUrl || null,
			chartId: item.chartId || null,
			chartTitle: item.chartTitle || null,
			chartUrl: item.chartUrl || null,
			labels: item.labels || []
		});
	}
	
	searchResults = allResults;
	isSearching = false;
	// Don't reset page here - the effect will handle it based on query changes
	}

	const typeOptions = ['Master Measure', 'Master Dimension', 'Sheet Measure', 'Sheet Dimension'];
	
	let searchEffectTimeout: ReturnType<typeof setTimeout> | null = null;
	
		// Track previous values to detect actual changes
		let previousQuery = '';
		let previousFilterSizes = { spaces: 0, apps: 0, sheets: 0, types: 0, sheetStates: 0 };
	
	// Effect for filter/query changes - triggers search when filters change
	$effect(() => {
		// Read all filter values to create reactive dependencies
		const query = searchQuery;
		const spacesSize = selectedSpaces.size;
		const appsSize = selectedApps.size;
		const sheetsSize = selectedSheets.size;
		const typesSize = selectedTypes.size;
		const sheetStatesSize = selectedSheetStates.size;
		
		// Check if query or filters actually changed
		const queryChanged = query !== previousQuery;
		const filtersChanged = 
			spacesSize !== previousFilterSizes.spaces ||
			appsSize !== previousFilterSizes.apps ||
			sheetsSize !== previousFilterSizes.sheets ||
			typesSize !== previousFilterSizes.types ||
			sheetStatesSize !== previousFilterSizes.sheetStates;
		
		// Reset page if query or filters changed
		if (queryChanged || filtersChanged) {
			currentPage = 1;
			previousQuery = query;
		}
		
		// Update filter sizes
		previousFilterSizes = { spaces: spacesSize, apps: appsSize, sheets: sheetsSize, types: typesSize, sheetStates: sheetStatesSize };
		
		// Only trigger search if something actually changed
		if (!queryChanged && !filtersChanged) {
			return;
		}
		
		if (searchEffectTimeout) {
			clearTimeout(searchEffectTimeout);
		}
		
		// Use untrack to read qlikApps.length without creating a dependency
		// This prevents the effect from re-running when new apps load
		const appsLoaded = untrack(() => qlikApps.length);
		
		// Always trigger search when filters change, even if no apps loaded yet
		// The search will filter based on what's available, and auto-refresh will update when data loads
		if (appsLoaded > 0) {
			isSearching = true;
			searchEffectTimeout = setTimeout(() => {
				performSearch(false);
			}, 200);
		} else {
			// No apps loaded yet - clear results
			searchResults = [];
			unfilteredResults = [];
			isSearching = false;
		}
		
		return () => {
			if (searchEffectTimeout) {
				clearTimeout(searchEffectTimeout);
			}
		};
	});
	
	// Track previous loading state to detect completion
	let previousLoadingState = false;
	
	// Effect to track when new data is available and loading completes
	$effect(() => {
		const currentAppsCount = qlikApps.length;
		const loading = isLoadingAppData;
		
		// Track when apps are added
		if (currentAppsCount > lastRefreshedAppsCount) {
			hasNewDataPending = true;
		}
		
		// Only trigger search when loading transitions from true to false (completion)
		// This prevents loops during loading
		if (previousLoadingState && !loading && hasNewDataPending && qlikApps.length > 0) {
			// Loading just completed - auto-refresh the table
			hasNewDataPending = false;
			lastRefreshedAppsCount = qlikApps.length;
			// Use incremental search to avoid clearing existing results
			performSearch(true);
		}
		
		previousLoadingState = loading;
	});
	
	function refreshTable() {
		lastRefreshedAppsCount = qlikApps.length;
		hasNewDataPending = false;
		performSearch();
	}

	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	function handleSearchInput(value: string) {
		searchQuery = value;
		isSearching = true;
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		searchTimeout = setTimeout(() => {
			performSearch();
		}, 300);
	}

	function toggleSpace(spaceId: string) {
		const newSet = createNewSet(selectedSpaces);
		if (newSet.has(spaceId)) {
			newSet.delete(spaceId);
		} else {
			newSet.add(spaceId);
		}
		selectedSpaces = newSet;
	}

	function toggleApp(appId: string) {
		const newSet = createNewSet(selectedApps);
		const wasSelected = newSet.has(appId);
		
		if (wasSelected) {
			newSet.delete(appId);
			// Remove sheets by sheetId (not sheetName) since selectedSheets stores sheetId values
			const sheetsToRemove = sheets
				.filter((sheet) => sheet.appId === appId)
				.map((sheet) => sheet.sheetId);
			const newSheetsSet = createNewSet(selectedSheets);
			sheetsToRemove.forEach((sheetId) => newSheetsSet.delete(sheetId));
			selectedSheets = newSheetsSet;
		} else {
			newSet.add(appId);
			loadAppDataPriority(appId);
		}
		selectedApps = newSet;
	}

	function toggleSheet(sheetId: string) {
		const newSet = createNewSet(selectedSheets);
		if (newSet.has(sheetId)) {
			newSet.delete(sheetId);
		} else {
			newSet.add(sheetId);
		}
		selectedSheets = newSet;
	}

	function selectAllSpaces() {
		// Include Personal space and all regular spaces
		selectedSpaces = new Set([PERSONAL_SPACE_ID, ...spaces.map((s) => s.id)]);
	}

	function deselectAllSpaces() {
		selectedSpaces = new Set();
	}

	function selectAllApps() {
		selectedApps = new Set(availableApps.map((a) => a.id));
		availableApps.forEach(app => {
			loadAppDataPriority(app.id);
		});
	}

	function deselectAllApps() {
		selectedApps = new Set();
		selectedSheets = new Set();
	}

	function selectAllSheets() {
		selectedSheets = new Set(availableSheets.map(s => s.id));
	}

	function deselectAllSheets() {
		selectedSheets = new Set();
	}

	function toggleType(typeName: string) {
		const newSet = createNewSet(selectedTypes);
		if (newSet.has(typeName)) {
			newSet.delete(typeName);
		} else {
			newSet.add(typeName);
		}
		selectedTypes = newSet;
	}

	function selectAllTypes() {
		selectedTypes = new Set<string>(availableTypes);
	}

	function deselectAllTypes() {
		selectedTypes = new Set();
	}

	function toggleSheetState(state: string) {
		const newSet = createNewSet(selectedSheetStates);
		if (newSet.has(state)) {
			newSet.delete(state);
		} else {
			newSet.add(state);
		}
		selectedSheetStates = newSet;
	}

	function selectAllSheetStates() {
		selectedSheetStates = new Set(['Public', 'Community', 'Private']);
	}

	function deselectAllSheetStates() {
		selectedSheetStates = new Set();
	}

	let copiedDefinitionId = $state<string | null>(null);

	async function copyToClipboard(text: string, id: string) {
		try {
			await navigator.clipboard.writeText(text);
			copiedDefinitionId = id;
			setTimeout(() => {
				copiedDefinitionId = null;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy text:', err);
		}
	}

	function exportToExcel() {
		if (searchResults.length === 0) {
			return;
		}

	const excelData = searchResults.map((result) => {
		const obj = result.object;
		const title = obj?.title || obj?.qAlias || (Array.isArray(obj?.qFieldLabels) && obj.qFieldLabels.length > 0 ? obj.qFieldLabels[0] : '') || 'N/A';
		const definition = obj?.qDef || 'N/A';
		const sheetName = result.sheet || result.sheetName || 'N/A';
		const sheetId = result.sheetId || result.context?.sheetId || null;
		const sheetUrl = result.sheetUrl || result.context?.sheetUrl || null;
		const chartId = result.chartId || obj?.qInfo?.qId || null;
		const chartTitle = result.chartTitle || result.context?.chartTitle || null;
		const chartUrl = result.chartUrl || result.context?.chartUrl || null;
		const labels = result.labels || [];

		return {
			Title: title,
			Definition: definition,
			App: result.app,
			Sheet: sheetName,
			Type: result.objectType || 'N/A',
			Labels: labels.length > 0 ? labels.join(', ') : 'N/A',
			'Sheet ID': sheetId || 'N/A',
			'Sheet URL': sheetUrl || 'N/A',
			'Chart Title': chartTitle || 'N/A',
			'Chart URL': chartUrl || 'N/A',
			'Chart ID': chartId || 'N/A'
		};
	});		const worksheet = XLSX.utils.json_to_sheet(excelData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Results');

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
		const filename = `search-results-${timestamp}.xlsx`;

		XLSX.writeFile(workbook, filename);
	}
</script>

<div class="w-full flex-1 flex min-h-0 {isSidebarCollapsed ? 'gap-[10px]' : 'gap-4'} relative min-w-0">
	<FilterSidebar
		spaces={availableSpaces}
		apps={availableApps}
		{availableSheets}
		selectedSpaces={selectedSpaces}
		{selectedApps}
		{selectedSheets}
		selectedSheetStates={selectedSheetStates}
		{loadedAppIds}
		{loadingAppIds}
		tenantHostname={currentTenantHostname}
		isCollapsed={isSidebarCollapsed}
		onToggleCollapse={() => isSidebarCollapsed = !isSidebarCollapsed}
		onToggleSpace={toggleSpace}
		onToggleApp={toggleApp}
		onToggleSheet={toggleSheet}
		onToggleSheetState={toggleSheetState}
		onSelectAllSpaces={selectAllSpaces}
		onDeselectAllSpaces={deselectAllSpaces}
		onSelectAllApps={selectAllApps}
		onDeselectAllApps={deselectAllApps}
		onSelectAllSheets={selectAllSheets}
		onDeselectAllSheets={deselectAllSheets}
		onSelectAllSheetStates={selectAllSheetStates}
		onDeselectAllSheetStates={deselectAllSheetStates}
	/>

	<div class="flex-1 flex flex-col min-h-0 min-w-0">
		{#if isLoadingApps}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Loading apps from Qlik tenant...</p>
				</div>
			</div>
		{:else if dataLoadError}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-center">
					<p class="text-sm text-red-600 dark:text-red-400 mb-4">{dataLoadError}</p>
					<button
						type="button"
						onclick={loadAppList}
						class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
					>
						Retry
					</button>
				</div>
			</div>
		{:else}
			<div class="flex-shrink-0">
				{#if isLoadingAppData && appItems.length > 0}
					<LoadingIndicator
						current={loadingProgress.current}
						total={loadingProgress.total}
						currentApp={loadingProgress.currentApp}
						hasNewData={hasNewDataPending}
						onRefreshTable={refreshTable}
					/>
				{:else if !isLoadingAppData && !isLoadingApps && appItems.length > 0 }
					<CompletionIndicator
						totalApps={appItems.length}
						onRefresh={refreshData}
					/>
				{/if}
			</div>
			
			<SearchInput
				value={searchQuery}
				{isSearching}
				onInput={handleSearchInput}
			/>

			<!-- Type Filter Chips -->
			{#if availableTypes.length > 0}
				<div class="flex items-center gap-3 mt-3 mb-2">
					<div class="flex flex-wrap gap-2">
						{#each availableTypes as typeName (typeName)}
							{@const isSelected = selectedTypes.has(typeName)}
							{@const colors = typeName === 'Master Measure' 
								? { selected: 'bg-blue-500 text-white border-blue-500', unselected: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700', check: 'text-white', box: 'bg-blue-200 dark:bg-blue-800/50' }
								: typeName === 'Master Dimension'
								? { selected: 'bg-purple-500 text-white border-purple-500', unselected: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700', check: 'text-white', box: 'bg-purple-200 dark:bg-purple-800/50' }
								: typeName === 'Sheet Measure'
								? { selected: 'bg-emerald-500 text-white border-emerald-500', unselected: 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700', check: 'text-white', box: 'bg-emerald-200 dark:bg-emerald-800/50' }
								: typeName === 'Sheet Dimension'
								? { selected: 'bg-amber-500 text-white border-amber-500', unselected: 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700', check: 'text-white', box: 'bg-amber-200 dark:bg-amber-800/50' }
								: { selected: 'bg-gray-500 text-white border-gray-500', unselected: 'bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600', check: 'text-white', box: 'bg-gray-300 dark:bg-gray-600' }
							}
							<button
								type="button"
								onclick={() => toggleType(typeName)}
								class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-all duration-150 {isSelected ? colors.selected : colors.unselected} hover:opacity-80"
							>
								<span class="w-3.5 h-3.5 flex items-center justify-center rounded-sm {isSelected ? '' : colors.box}">
									{#if isSelected}
										<svg 
											class="w-3.5 h-3.5 {colors.check}" 
											fill="none" 
											stroke="currentColor" 
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
										</svg>
									{/if}
								</span>
								{typeName}
							</button>
						{/each}
					</div>
					<div class="flex gap-1 text-xs ml-auto">
						<button
							type="button"
							onclick={selectAllTypes}
							class="text-indigo-600 dark:text-indigo-400 hover:underline"
						>
							All
						</button>
						<span class="text-gray-400">|</span>
						<button
							type="button"
							onclick={deselectAllTypes}
							class="text-indigo-600 dark:text-indigo-400 hover:underline"
						>
							None
						</button>
					</div>
				</div>
			{/if}
		
			<div class="flex flex-col">
				{#if isSearching && searchResults.length === 0}
					<div class="flex flex-col flex-1 min-h-0 items-center justify-center">
						<div class="flex flex-col items-center gap-4">
							<svg
								class="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							<p class="text-sm text-gray-600 dark:text-gray-400">Searching...</p>
						</div>
					</div>
				{:else}
					<SearchResultsTable
					results={searchResults}
					totalResults={searchResults.length}
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={goToPage}
					onNextPage={goToNextPage}
					onPreviousPage={goToPreviousPage}
					{searchQuery}
					onExportToExcel={exportToExcel}
					onCopyToClipboard={copyToClipboard}
					copiedDefinitionId={copiedDefinitionId}
					tenantUrl={currentTenantUrl}
					/>
				{/if}
			</div>
		{/if}
	</div>
</div>
