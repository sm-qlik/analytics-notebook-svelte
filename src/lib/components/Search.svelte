<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, configureQlikAuthOnce, resetAuthConfiguration } from '$lib/utils/qlik-auth';
	import { EngineInterface } from '$lib/utils/engine-interface';
	import { appCache, getCacheKey, type AppItem, type CachedAppData, type SearchIndexItem, type SearchFilters } from '$lib/stores/app-cache';
	import * as XLSX from 'xlsx';
	import FilterSidebar from './FilterSidebar.svelte';
	import SearchInput from './SearchInput.svelte';
	import SearchResultsTable from './SearchResultsTable.svelte';
	import LoadingIndicator from './LoadingIndicator.svelte';
	import CompletionIndicator from './CompletionIndicator.svelte';

	interface Props {
		refreshTrigger?: number;
	}

	let { refreshTrigger = 0 }: Props = $props();

	// Track previous trigger value to detect changes
	let lastRefreshTrigger = $state(0);

	// Effect to handle external refresh triggers (checks for updates)
	$effect(() => {
		if (refreshTrigger > lastRefreshTrigger) {
			lastRefreshTrigger = refreshTrigger;
			// Use untrack to avoid infinite loops
			untrack(() => {
				checkForUpdates();
			});
		}
	});

	let searchQuery = $state('');
	let searchResults = $state([] as Array<{
		path: string;
		object: any;
		objectType: string | null;
		context: any;
		file?: string;
		app?: string;
		appId: string; // Required - all data comes from apps
		sheet?: string | null;
		sheetName?: string | null;
		sheetId?: string | null;
		sheetUrl?: string | null;
		chartId?: string | null;
		chartTitle?: string | null;
		chartUrl?: string | null;
		labels?: string[];
	}>);
	let unfilteredResults = $state([] as Array<{
		path: string;
		object: any;
		objectType: string | null;
		context: any;
		file?: string;
		app?: string;
		appId: string; // Required - all data comes from apps
		sheet?: string | null;
		sheetName?: string | null;
		sheetId?: string | null;
		sheetUrl?: string | null;
		chartId?: string | null;
		chartTitle?: string | null;
		chartUrl?: string | null;
		labels?: string[];
	}>);
	let isSearching = $state(false);
	let isLoadingApps = $state(false);
	let isLoadingAppData = $state(false);
	let dataLoadError = $state<string | null>(null);
	let loadingProgress = $state({ current: 0, total: 0, currentApp: '' });
	
	// App metadata - we no longer store full structure data in qlikApps to save memory
	// Full structure data is stored in IndexedDB and queried on demand
	let qlikApps = $state<Array<{ id: string; name: string; spaceId?: string; data?: any }>>([]);
	let apps = $state<Array<{ name: string; id: string; spaceId?: string }>>([]);
	let appItems = $state<AppItem[]>([]);
	let spaces = $state<Array<{ name: string; id: string }>>([]);
	let sheets = $state<Array<{ name: string; app: string; appId: string; sheetId: string; approved?: boolean; published?: boolean }>>([]);
	let sheetMetadata = $state<Map<string, { approved: boolean; published: boolean }>>(new Map());
	let loadingAppIds = $state<Set<string>>(new Set());
	let totalSearchResults = $state(0); // Total count from IndexedDB query
	
	// Mutex for serializing sheet metadata updates to prevent race conditions
	let metadataUpdateQueue: Promise<void> = Promise.resolve();
	let currentTenantHostname = $state('');
	let currentTenantUrl = $state<string | null>(null);
	let currentUserId = $state<string | null>(null);
	let hasNewDataPending = $state(false);
	let lastRefreshedAppsCount = $state(0);
	let isAuthConfigured = $state(false);
	let isSidebarCollapsed = $state(false);
	let currentPage = $state(1);
	let cacheLoadedAppsCount = $state(0); // Track how many apps were loaded from cache
	let failedAppsCount = $state(0); // Track how many apps failed to load
	let pendingAppsToLoad = $state<AppItem[]>([]); // Apps waiting to be loaded (paused due to space filter)
	let isLoadingPaused = $state(false); // Track if loading is paused due to space filter
	let isLoadingDismissed = $state(false); // Track if loading indicator was dismissed by user
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

	// Available object types - dynamically derived from search index for extensibility
	let availableTypes = $state<string[]>([]);
	let availableTypesCacheKey = $state<string | null>(null); // Track which cache key the types are for
	
	/**
	 * Load available object types from the search index cache
	 * This is performant because:
	 * 1. It uses IndexedDB index cursors (fast)
	 * 2. Results are cached per tenant/user
	 * 3. Only re-fetches when cache key changes or search index is updated
	 */
	async function loadAvailableTypes() {
		if (!currentTenantUrl || !currentUserId) {
			availableTypes = [];
			availableTypesCacheKey = null;
			return;
		}
		
		const cacheKey = getCacheKey(currentTenantUrl, currentUserId);
		
		// Skip if we already have types for this cache key
		if (availableTypesCacheKey === cacheKey && availableTypes.length > 0) {
			return;
		}
		
		try {
			const types = await appCache.getUniqueValues(currentTenantUrl, currentUserId, 'objectType');
			// Filter out null/empty values and sort for consistency
			availableTypes = types.filter(t => t && t.trim()).sort();
			availableTypesCacheKey = cacheKey;
		} catch (err) {
			console.warn('Failed to load available types from cache:', err);
			// Fallback to empty array - types will appear as data is indexed
			availableTypes = [];
			availableTypesCacheKey = null;
		}
	}
	
	// Load available types when tenant/user changes or when search index is updated
	$effect(() => {
		if (currentTenantUrl && currentUserId) {
			loadAvailableTypes();
		} else {
			availableTypes = [];
			availableTypesCacheKey = null;
		}
	});

	function extractSearchableFields(obj: any): string {
		if (obj === null || obj === undefined) return '';
		
		const searchableFields: string[] = [];
		const fieldsToSearch = ['qFieldDefs', 'qFieldLabels', 'qLabelExpression', 'qAlias', 'title', 'qDef', 'qTitle'];
		
		function flattenValue(value: any): string {
			if (value === null || value === undefined) return '';
			if (typeof value === 'string') return value;
			if (typeof value === 'number' || typeof value === 'boolean') return String(value);
			if (Array.isArray(value)) {
				return value.map(item => flattenValue(item)).filter(Boolean).join(' ');
			}
			if (typeof value === 'object') {
				return Object.entries(value)
					.map(([key, val]) => flattenValue(val))
					.filter(Boolean)
					.join(' ');
			}
			return '';
		}
		
		fieldsToSearch.forEach(field => {
			if (obj[field] !== undefined && obj[field] !== null) {
				const value = flattenValue(obj[field]);
				if (value) {
					searchableFields.push(value);
				}
			}
		});
		
		return searchableFields.join(' ');
	}

	function extractLabels(obj: any, parentObj: any = null, context: any = null, qDefString: string | null = null): string[] {
		if (obj === null && parentObj === null && context === null && qDefString === null) return [];
		
		const labels: string[] = [];
		
		// Helper function to extract string from qTitle (can be string or object with qv property)
		function extractQTitle(qTitle: any): string | null {
			if (!qTitle) return null;
			if (typeof qTitle === 'string' && qTitle.trim()) {
				return qTitle.trim();
			}
			if (typeof qTitle === 'object' && qTitle.qv && typeof qTitle.qv === 'string' && qTitle.qv.trim()) {
				return qTitle.qv.trim();
			}
			return null;
		}
		
		// Helper function to extract qFieldLabels (can be array of strings)
		function extractQFieldLabels(qFieldLabels: any): string[] {
			if (!qFieldLabels) return [];
			const extracted: string[] = [];
			if (Array.isArray(qFieldLabels)) {
				qFieldLabels.forEach((label: any) => {
					if (typeof label === 'string' && label.trim()) {
						extracted.push(label.trim());
					} else if (typeof label === 'object' && label !== null) {
						// Handle object labels - extract string value
						if (label.qv && typeof label.qv === 'string') {
							extracted.push(label.qv.trim());
						} else if (label.qDef && typeof label.qDef === 'string') {
							extracted.push(label.qDef.trim());
						} else {
							const str = String(label).trim();
							if (str && str !== '[object Object]') {
								extracted.push(str);
							}
						}
					}
				});
			} else if (typeof qFieldLabels === 'string' && qFieldLabels.trim()) {
				extracted.push(qFieldLabels.trim());
			} else if (typeof qFieldLabels === 'object' && qFieldLabels !== null) {
				// Handle single object label
				if (qFieldLabels.qv && typeof qFieldLabels.qv === 'string') {
					extracted.push(qFieldLabels.qv.trim());
				} else if (qFieldLabels.qDef && typeof qFieldLabels.qDef === 'string') {
					extracted.push(qFieldLabels.qDef.trim());
				}
			}
			return extracted;
		}
		
		// Check the object itself first (for master dimensions/measures where obj is qDim or qMeasure)
		if (typeof obj === 'object' && obj !== null) {
			// Extract qLabel
			if (obj.qLabel && typeof obj.qLabel === 'string' && obj.qLabel.trim()) {
				labels.push(obj.qLabel.trim());
			} else if (obj.qLabel && typeof obj.qLabel === 'object' && obj.qLabel.qv && typeof obj.qLabel.qv === 'string') {
				labels.push(obj.qLabel.qv.trim());
			}
			// Extract qTitle
			const qTitle = extractQTitle(obj.qTitle);
			if (qTitle) {
				labels.push(qTitle);
			}
			// Extract qFieldLabels from object
			const objFieldLabels = extractQFieldLabels(obj.qFieldLabels);
			if (objFieldLabels.length > 0) {
				labels.push(...objFieldLabels);
			}
		}
		
		// If obj is a qDef string or we need to check parentObj, look there
		if (parentObj && typeof parentObj === 'object') {
			// Check if parentObj has qDim with qLabel (for master dimension references)
			if (parentObj.qDim?.qLabel) {
				if (typeof parentObj.qDim.qLabel === 'string' && parentObj.qDim.qLabel.trim()) {
					labels.push(parentObj.qDim.qLabel.trim());
				} else if (typeof parentObj.qDim.qLabel === 'object' && parentObj.qDim.qLabel.qv && typeof parentObj.qDim.qLabel.qv === 'string') {
					labels.push(parentObj.qDim.qLabel.qv.trim());
				}
			}
			const qDimTitle = extractQTitle(parentObj.qDim?.qTitle);
			if (qDimTitle) {
				labels.push(qDimTitle);
			}
			// Extract qFieldLabels from qDim
			const qDimFieldLabels = extractQFieldLabels(parentObj.qDim?.qFieldLabels);
			labels.push(...qDimFieldLabels);
			// Check if parentObj has qMeasure with qLabel (for master measure references)
			if (parentObj.qMeasure?.qLabel) {
				if (typeof parentObj.qMeasure.qLabel === 'string' && parentObj.qMeasure.qLabel.trim()) {
					labels.push(parentObj.qMeasure.qLabel.trim());
				} else if (typeof parentObj.qMeasure.qLabel === 'object' && parentObj.qMeasure.qLabel.qv && typeof parentObj.qMeasure.qLabel.qv === 'string') {
					labels.push(parentObj.qMeasure.qLabel.qv.trim());
				}
			}
			const qMeasureTitle = extractQTitle(parentObj.qMeasure?.qTitle);
			if (qMeasureTitle) {
				labels.push(qMeasureTitle);
			}
			// Extract qFieldLabels from qMeasure
			const qMeasureFieldLabels = extractQFieldLabels(parentObj.qMeasure?.qFieldLabels);
			labels.push(...qMeasureFieldLabels);
			// Check parentObj directly for qLabel and qTitle
			if (parentObj.qLabel) {
				if (typeof parentObj.qLabel === 'string' && parentObj.qLabel.trim()) {
					labels.push(parentObj.qLabel.trim());
				} else if (typeof parentObj.qLabel === 'object' && parentObj.qLabel.qv && typeof parentObj.qLabel.qv === 'string') {
					labels.push(parentObj.qLabel.qv.trim());
				}
			}
			const parentQTitle = extractQTitle(parentObj.qTitle);
			if (parentQTitle) {
				labels.push(parentQTitle);
			}
			// Extract qFieldLabels from parentObj directly
			const parentFieldLabels = extractQFieldLabels(parentObj.qFieldLabels);
			labels.push(...parentFieldLabels);
		}
		
		// Note: chartTitle and sheetName/sheetTitle are excluded from labels
		// since they have their own dedicated columns in the table
		
		// Helper function to get qDef value as string (for comparison)
		function getQDefString(obj: any): string | null {
			if (!obj) return null;
			if (typeof obj === 'string') return obj.trim();
			if (typeof obj === 'object' && obj !== null) {
				if (obj.qDef) {
					if (typeof obj.qDef === 'string') return obj.qDef.trim();
					if (typeof obj.qDef === 'object' && obj.qDef.qv) return String(obj.qDef.qv).trim();
					if (typeof obj.qDef === 'object' && obj.qDef.qDef) return String(obj.qDef.qDef).trim();
				}
				if (obj.qv) return String(obj.qv).trim();
			}
			return null;
		}
		
		// Collect all qDef values to filter against
		const qDefValues = new Set<string>();
		// If qDefString was passed explicitly (when obj is a string qDef), use it
		if (qDefString) {
			qDefValues.add(qDefString.trim());
		}
		// Also check obj if it's a string (the qDef itself)
		if (typeof obj === 'string') {
			qDefValues.add(obj.trim());
		} else if (obj) {
			const objQDef = getQDefString(obj);
			if (objQDef) qDefValues.add(objQDef);
		}
		if (parentObj) {
			const parentQDef = getQDefString(parentObj);
			if (parentQDef) qDefValues.add(parentQDef);
			if (parentObj.qDim) {
				const qDimQDef = getQDefString(parentObj.qDim);
				if (qDimQDef) qDefValues.add(qDimQDef);
			}
			if (parentObj.qMeasure) {
				const qMeasureQDef = getQDefString(parentObj.qMeasure);
				if (qMeasureQDef) qDefValues.add(qMeasureQDef);
			}
		}
		
		// Filter labels: remove duplicates, ensure strings, exclude definitions
		const filteredLabels = labels
			.map((label: any) => {
				// Ensure label is a string
				if (typeof label !== 'string') {
					// Try to extract string from object
					if (typeof label === 'object' && label !== null) {
						if (label.qv && typeof label.qv === 'string') return label.qv.trim();
						if (label.qDef && typeof label.qDef === 'string') return label.qDef.trim();
						const str = String(label).trim();
						// Don't include [object Object]
						if (str === '[object Object]') return '';
						return str;
					}
					const str = String(label).trim();
					if (str === '[object Object]') return '';
					return str;
				}
				return label.trim();
			})
			.filter(label => {
				// Exclude empty labels
				if (!label) return false;
				
				// Exclude any label that looks like a Qlik expression (starts with =)
				if (label.startsWith('=')) return false;
				
				// Exclude any label that matches a qDef value (exact match or after removing =)
				if (qDefValues.has(label)) return false;
				// Also check if label matches qDef without the leading =
				const labelWithoutEquals = label.startsWith('=') ? label.substring(1).trim() : label;
				if (qDefValues.has(labelWithoutEquals)) return false;
				// Check if any qDef value matches the label (with or without =)
				for (const qDef of qDefValues) {
					const qDefWithoutEquals = qDef.startsWith('=') ? qDef.substring(1).trim() : qDef;
					if (label === qDef || label === qDefWithoutEquals || labelWithoutEquals === qDef || labelWithoutEquals === qDefWithoutEquals) {
						return false;
					}
				}
				
				return true;
			});
		
		// Remove duplicates and return
		return [...new Set(filteredLabels)];
	}


	/**
	 * Extract and store searchable items for a single app in IndexedDB
	 * This is more memory-efficient than building a huge in-memory index
	 */
	async function storeAppSearchIndex(
		appId: string,
		appName: string,
		spaceId: string | undefined,
		structureData: any,
		tenantUrl: string,
		userId: string
	): Promise<number> {
		const cacheKey = getCacheKey(tenantUrl, userId);
		const searchItems: SearchIndexItem[] = [];
		const processedPaths = new Set<string>();

		// Build a map of sheet ID to approved/published status
		const sheetStatusMap = new Map<string, { approved: boolean; published: boolean }>();
		const sheetsArray = structureData.sheets || [];
		sheetsArray.forEach((sheet: any) => {
			const sheetId = sheet?.qProperty?.qInfo?.qId || '';
			if (sheetId) {
				sheetStatusMap.set(sheetId, {
					approved: !!sheet.approved,
					published: !!sheet.published
				});
			}
		});

		// Helper to extract qDef string
		function safeExtractQDef(value: any): string {
			if (value === null || value === undefined) return '';
			if (typeof value === 'string') return value.trim();
			if (typeof value === 'object') {
				if (value.qv && typeof value.qv === 'string') return value.qv.trim();
				if (value.qDef && typeof value.qDef === 'string') return value.qDef.trim();
				if (Array.isArray(value.qFieldDefs) && value.qFieldDefs.length > 0) {
					return value.qFieldDefs.join(' ');
				}
			}
			return '';
		}

		// Helper to get sheet status
		function getSheetStatus(sheetId: string): { approved: boolean; published: boolean } {
			return sheetStatusMap.get(sheetId) || { approved: false, published: false };
		}

		// Process master dimensions
		const masterDimensions = structureData.masterDimensions || [];
		masterDimensions.forEach((dim: any, idx: number) => {
			if (!dim.qDim) return;
			const path = `masterDimensions[${idx}].qDim`;
			const id = `${cacheKey}:${appId}:${path}`;
			if (processedPaths.has(id)) return;
			processedPaths.add(id);

			const labels = dim.qDim.qFieldLabels || [];
			const title = dim.qMetaDef?.title || dim.qDim.qLabel || '';
			const definition = safeExtractQDef(dim.qDim.qFieldDefs) || safeExtractQDef(dim.qDim);

			searchItems.push({
				id,
				tenantUser: cacheKey,
				appId,
				appName,
				spaceId: spaceId || '',
				sheetId: '',
				sheetName: '',
				sheetUrl: '',
				sheetApproved: false,
				sheetPublished: false,
				objectType: 'Master Dimension',
				title: typeof title === 'string' ? title : '',
				labels: Array.isArray(labels) ? labels.filter((l: any) => typeof l === 'string') : [],
				labelsText: Array.isArray(labels) ? labels.filter((l: any) => typeof l === 'string').join(' ') : '',
				searchText: `${title} ${definition} ${Array.isArray(labels) ? labels.join(' ') : ''}`.trim(),
				definition,
				chartId: '',
				chartTitle: '',
				chartUrl: '',
				path
			});
		});

		// Process master measures
		const masterMeasures = structureData.masterMeasures || [];
		masterMeasures.forEach((measure: any, idx: number) => {
			if (!measure.qMeasure) return;
			const path = `masterMeasures[${idx}].qMeasure`;
			const id = `${cacheKey}:${appId}:${path}`;
			if (processedPaths.has(id)) return;
			processedPaths.add(id);

			const title = measure.qMetaDef?.title || measure.qMeasure.qLabel || '';
			const definition = safeExtractQDef(measure.qMeasure.qDef) || safeExtractQDef(measure.qMeasure);

			searchItems.push({
				id,
				tenantUser: cacheKey,
				appId,
				appName,
				spaceId: spaceId || '',
				sheetId: '',
				sheetName: '',
				sheetUrl: '',
				sheetApproved: false,
				sheetPublished: false,
				objectType: 'Master Measure',
				title: typeof title === 'string' ? title : '',
				labels: [],
				labelsText: '',
				searchText: `${title} ${definition}`.trim(),
				definition,
				chartId: '',
				chartTitle: '',
				chartUrl: '',
				path
			});
		});

		// Process sheet dimensions
		const sheetDimensions = structureData.sheetDimensions || [];
		sheetDimensions.forEach((dim: any, idx: number) => {
			const path = `sheetDimensions[${idx}].qDef`;
			const id = `${cacheKey}:${appId}:${path}`;
			if (processedPaths.has(id)) return;
			processedPaths.add(id);

			const sheetId = dim.sheetId || '';
			const sheetName = dim.sheetTitle || '';
			const sheetUrl = dim.sheetUrl || '';
			const chartId = dim.chartId || '';
			const chartTitle = dim.chartTitle || '';
			const chartUrl = dim.chartUrl || '';
			const definition = safeExtractQDef(dim.qDef) || safeExtractQDef(dim);
			const labels = dim.qFieldLabels || [];
			const title = dim.title || '';
			const sheetStatus = getSheetStatus(sheetId);

			searchItems.push({
				id,
				tenantUser: cacheKey,
				appId,
				appName,
				spaceId: spaceId || '',
				sheetId,
				sheetName,
				sheetUrl,
				sheetApproved: sheetStatus.approved,
				sheetPublished: sheetStatus.published,
				objectType: 'Sheet Dimension',
				title: typeof title === 'string' ? title : '',
				labels: Array.isArray(labels) ? labels.filter((l: any) => typeof l === 'string') : [],
				labelsText: Array.isArray(labels) ? labels.filter((l: any) => typeof l === 'string').join(' ') : '',
				searchText: `${title} ${definition} ${sheetName} ${chartTitle} ${Array.isArray(labels) ? labels.join(' ') : ''}`.trim(),
				definition,
				chartId,
				chartTitle,
				chartUrl,
				path
			});
		});

		// Process sheet measures
		const sheetMeasures = structureData.sheetMeasures || [];
		sheetMeasures.forEach((measure: any, idx: number) => {
			const path = `sheetMeasures[${idx}].qDef`;
			const id = `${cacheKey}:${appId}:${path}`;
			if (processedPaths.has(id)) return;
			processedPaths.add(id);

			const sheetId = measure.sheetId || '';
			const sheetName = measure.sheetTitle || '';
			const sheetUrl = measure.sheetUrl || '';
			const chartId = measure.chartId || '';
			const chartTitle = measure.chartTitle || '';
			const chartUrl = measure.chartUrl || '';
			const definition = safeExtractQDef(measure.qDef) || safeExtractQDef(measure);
			const title = measure.title || '';
			const sheetStatus = getSheetStatus(sheetId);

			searchItems.push({
				id,
				tenantUser: cacheKey,
				appId,
				appName,
				spaceId: spaceId || '',
				sheetId,
				sheetName,
				sheetUrl,
				sheetApproved: sheetStatus.approved,
				sheetPublished: sheetStatus.published,
				objectType: 'Sheet Measure',
				title: typeof title === 'string' ? title : '',
				labels: [],
				labelsText: '',
				searchText: `${title} ${definition} ${sheetName} ${chartTitle}`.trim(),
				definition,
				chartId,
				chartTitle,
				chartUrl,
				path
			});
		});

		// Store in IndexedDB
		if (searchItems.length > 0) {
			await appCache.addSearchIndexItems(searchItems);
			// Refresh available types after indexing new items (may include new object types)
			await loadAvailableTypes();
		}

		return searchItems.length;
	}

	/**
	 * Perform search using IndexedDB - much more memory efficient for large datasets
	 */
	async function performIndexedDBSearch(): Promise<void> {
		if (!currentTenantUrl || !currentUserId) {
			searchResults = [];
			totalSearchResults = 0;
			return;
		}

		isSearching = true;
		const cacheKey = getCacheKey(currentTenantUrl, currentUserId);

		try {
			// Build filter arrays from selected sets
			const spaceIdsFilter = selectedSpaces.size > 0 
				? Array.from(selectedSpaces).map(id => id === PERSONAL_SPACE_ID ? '' : id)
				: undefined;
			
			const appIdsFilter = selectedApps.size > 0 
				? Array.from(selectedApps)
				: undefined;

			const sheetIdsFilter = selectedSheets.size > 0
				? Array.from(selectedSheets)
				: undefined;

			const typeFilter = selectedTypes.size > 0
				? Array.from(selectedTypes)
				: undefined;

			const filters: SearchFilters = {
				tenantUser: cacheKey,
				spaceIds: spaceIdsFilter,
				appIds: appIdsFilter,
				sheetIds: sheetIdsFilter,
				objectTypes: typeFilter,
				searchText: searchQuery.trim() || undefined
				// No limit - return all matching results
			};

			// Get total count
			totalSearchResults = await appCache.countSearchIndex(filters);

			// Get results
			const indexResults = await appCache.querySearchIndex(filters);

			// Check if sheet state filter is active
			const hasSheetStateFilter = selectedSheetStates.size > 0 && selectedSheetStates.size < 3;

			// Convert to search results format, applying sheet state filter if needed
			let results = indexResults.map(item => ({
				path: item.path,
				object: { qDef: item.definition, title: item.title, qFieldLabels: item.labels },
				objectType: item.objectType,
				context: {},
				file: item.appId,
				app: item.appName,
				appId: item.appId,
				sheet: item.sheetName || null,
				sheetName: item.sheetName || null,
				sheetId: item.sheetId || null,
				sheetUrl: item.sheetUrl || null,
				chartId: item.chartId || null,
				chartTitle: item.chartTitle || null,
				chartUrl: item.chartUrl || null,
				labels: item.labels
			}));

			// Apply sheet state filter (uses runtime metadata, can't be done in IndexedDB)
			if (hasSheetStateFilter) {
				results = results.filter(item => {
					const sheetState = getSheetState(item.sheetId);
					return sheetState && selectedSheetStates.has(sheetState);
				});
				// Update the total count to reflect filtered results
				totalSearchResults = results.length;
			}

			searchResults = results;
			unfilteredResults = searchResults;

		} catch (err) {
			console.error('IndexedDB search failed:', err);
			searchResults = [];
			totalSearchResults = 0;
		} finally {
			isSearching = false;
		}
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
			
			// Fetch all spaces with pagination
			const allSpacesData: any[] = [];
			let nextUrl: string | null = null;
			let pageCount = 0;
			const maxPages = 100; // Safety limit
			
			// First request
			let spacesResponse = await spacesApi.getSpaces({ limit: 100 });
			if (spacesResponse.status !== 200) {
				throw new Error(`Failed to get spaces: ${spacesResponse.status}`);
			}
			
			allSpacesData.push(...(spacesResponse.data?.data || []));
			nextUrl = spacesResponse.data?.links?.next?.href || null;
			pageCount++;
			
			// Follow pagination links
			while (nextUrl && pageCount < maxPages) {
				try {
					// Extract query params from the next URL
					const url = new URL(nextUrl, 'https://placeholder.com');
					const searchParams = new URLSearchParams(url.search);
					
					spacesResponse = await spacesApi.getSpaces({ 
						limit: 100,
						...Object.fromEntries(searchParams.entries())
					});
					
					if (spacesResponse.status !== 200) {
						console.warn(`Spaces pagination request failed with status ${spacesResponse.status}, stopping`);
						break;
					}
					
					const pageSpaces = spacesResponse.data?.data || [];
					if (pageSpaces.length === 0) {
						break;
					}
					
					allSpacesData.push(...pageSpaces);
					nextUrl = spacesResponse.data?.links?.next?.href || null;
					pageCount++;
					
					console.log(`Loaded page ${pageCount} of spaces (${allSpacesData.length} total so far)`);
				} catch (err) {
					console.warn('Error during spaces pagination, stopping:', err);
					break;
				}
			}
			
			console.log(`Finished loading ${allSpacesData.length} spaces across ${pageCount} pages`);
			
			spaces = allSpacesData
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

	/**
	 * Fetch all apps from the API with pagination support
	 * Follows link.next URLs to retrieve all apps (not just first 100)
	 */
	async function fetchAllAppItems(items: any): Promise<AppItem[]> {
		const allApps: AppItem[] = [];
		let nextUrl: string | null = null;
		let pageCount = 0;
		const maxPages = 100; // Safety limit to prevent infinite loops
		
		// First request
		let response = await items.getItems({ resourceType: 'app', limit: 100 });
		if (response.status !== 200) {
			throw new Error(`Failed to get items: ${response.status}`);
		}
		
		allApps.push(...(response.data?.data || []));
		nextUrl = response.data?.links?.next?.href || null;
		pageCount++;
		
		// Follow pagination links
		while (nextUrl && pageCount < maxPages) {
			try {
				// Extract the path from the full URL for the next request
				const url = new URL(nextUrl, 'https://placeholder.com');
				const searchParams = new URLSearchParams(url.search);
				
				response = await items.getItems({ 
					resourceType: 'app', 
					limit: 100,
					...Object.fromEntries(searchParams.entries())
				});
				
				if (response.status !== 200) {
					console.warn(`Pagination request failed with status ${response.status}, stopping pagination`);
					break;
				}
				
				const pageApps = response.data?.data || [];
				if (pageApps.length === 0) {
					break;
				}
				
				allApps.push(...pageApps);
				nextUrl = response.data?.links?.next?.href || null;
				pageCount++;
				
				console.log(`Loaded page ${pageCount} of apps (${allApps.length} total so far)`);
			} catch (err) {
				console.warn('Error during pagination, stopping:', err);
				break;
			}
		}
		
		console.log(`Finished loading ${allApps.length} apps across ${pageCount} pages`);
		return allApps;
	}
	
	async function loadAppList() {
		if (isLoadingApps || appItems.length > 0) return;
		
		isLoadingApps = true;
		dataLoadError = null;
		cacheLoadedAppsCount = 0;
		
		try {
			const { qlikApi, tenantUrl } = await ensureAuthConfigured();
			const { items, users } = qlikApi;
			
			// Get current user ID for cache keying
			let userId = currentUserId;
			if (!userId) {
				try {
					const userResponse = await users.getMyUser();
					if (userResponse.status === 200 && userResponse.data?.id) {
						userId = userResponse.data.id;
						currentUserId = userId;
					}
				} catch (e) {
					console.warn('Failed to get user ID, using fallback:', e);
					userId = 'default';
					currentUserId = userId;
				}
			}
			
			// Load spaces in parallel with apps (don't await to avoid blocking)
			loadSpaces().catch(err => {
				// Spaces are optional, so we don't throw - just leave spaces array empty
			});
			
			// Fetch ALL apps with pagination
			const allApps = await fetchAllAppItems(items);
			appItems = allApps;
			apps = allApps.map((app: any) => ({
				name: app.name || app.resourceId,
				id: app.resourceId,
				spaceId: app.spaceId || app.space?.resourceId || undefined
			}));
			
			// Check cache and determine which apps need loading - LIGHTWEIGHT comparison
			if (tenantUrl && userId) {
				const { toLoad, toRemove, unchangedMetadata } = await appCache.getAppsToUpdateLightweight(
					tenantUrl,
					userId,
					allApps
				);
				
				console.log(`Cache analysis: ${unchangedMetadata.length} unchanged, ${toLoad.length} to load, ${toRemove.length} to remove`);
				
				// Remove apps that no longer exist (both cache and search index)
				if (toRemove.length > 0) {
					console.log(`Removing ${toRemove.length} apps that no longer exist:`, toRemove);
					await appCache.removeApps(tenantUrl, userId, toRemove);
				}
				
				// Remove search index for apps that need updating (will be rebuilt when loaded)
				// For new apps this is a no-op, for updated apps it clears stale entries
				for (const app of toLoad) {
					await appCache.removeSearchIndexForApp(tenantUrl, userId, app.resourceId);
				}
				
				// Load unchanged apps from cache - OPTIMIZED PATH (metadata only)
				if (unchangedMetadata.length > 0) {
					// Use lightweight metadata directly (no full structure data loaded)
					qlikApps = unchangedMetadata.map(cached => ({
						id: cached.id,
						name: cached.name,
						spaceId: cached.spaceId
					}));
					cacheLoadedAppsCount = unchangedMetadata.length;
					
					// Check if search index already exists and has all the apps we need
					const indexedAppIds = await appCache.getIndexedAppIds(tenantUrl, userId);
					const allUnchangedIndexed = unchangedMetadata.every(app => indexedAppIds.has(app.id));
					
					if (allUnchangedIndexed && indexedAppIds.size > 0) {
						// FAST PATH: Search index already exists with all cached apps
						// Load sheets directly from search index instead of re-processing each app
						console.log(`Using existing search index (${indexedAppIds.size} apps indexed)`);
						
						const indexedSheets = await appCache.getSheetsFromSearchIndex(tenantUrl, userId);
						sheets = indexedSheets.map(s => ({
							name: s.sheetName,
							app: s.appName,
							appId: s.appId,
							sheetId: s.sheetId,
							approved: s.approved,
							published: s.published
						}));
						
						// Populate sheetMetadata map for sheet state filtering
						const newMetadata = new Map<string, { approved: boolean; published: boolean }>();
						indexedSheets.forEach(s => {
							if (s.sheetId) {
								newMetadata.set(s.sheetId, { approved: s.approved, published: s.published });
							}
						});
						sheetMetadata = newMetadata;
						
						console.log(`Loaded ${sheets.length} sheets from search index`);
					} else {
						// SLOW PATH: Need to rebuild search index from cached app data
						// This only happens on first load or after DB schema changes
						console.log(`Rebuilding search index for ${unchangedMetadata.length} cached apps...`);
						
						// Need to load full data only for apps missing from index
						const appsNeedingIndexRebuild = unchangedMetadata.filter(app => !indexedAppIds.has(app.id));
						for (const appMeta of appsNeedingIndexRebuild) {
							const cachedData = await appCache.getAppData(tenantUrl, userId, appMeta.id);
							if (cachedData?.data) {
								await processSheets(cachedData.data, cachedData.name, cachedData.id);
								await storeAppSearchIndex(
									cachedData.id,
									cachedData.name,
									cachedData.spaceId,
									cachedData.data,
									tenantUrl,
									userId
								);
							}
						}
						
						// Load sheets from index for apps that were already indexed
						if (indexedAppIds.size > 0) {
							const indexedSheets = await appCache.getSheetsFromSearchIndex(tenantUrl, userId);
							const existingSheetIds = new Set(sheets.map(s => s.sheetId));
							const newSheets = indexedSheets
								.filter(s => !existingSheetIds.has(s.sheetId))
								.map(s => ({
									name: s.sheetName,
									app: s.appName,
									appId: s.appId,
									sheetId: s.sheetId,
									approved: s.approved,
									published: s.published
								}));
							sheets = [...sheets, ...newSheets];
							
							// Update sheetMetadata map with sheets from index
							const newMetadata = new Map(sheetMetadata);
							indexedSheets.forEach(s => {
								if (s.sheetId && !newMetadata.has(s.sheetId)) {
									newMetadata.set(s.sheetId, { approved: s.approved, published: s.published });
								}
							});
							sheetMetadata = newMetadata;
						}
						
						console.log(`Rebuilt search index for ${appsNeedingIndexRebuild.length} apps`);
					}
					
					// Trigger search
					await performIndexedDBSearch();
					
					console.log(`Loaded ${unchangedMetadata.length} apps from cache`);
				} else {
					// Nothing in cache (e.g., cache was cleared) - reset in-memory state
					console.log('No cached data found, clearing in-memory state');
					qlikApps = [];
					sheets = [];
					sheetMetadata = new Map();
					cacheLoadedAppsCount = 0;
				}
				
				// Load remaining apps in background (only the ones that need loading)
				if (toLoad.length > 0) {
					loadAppDataInBackground(toLoad);
				} else if (unchangedMetadata.length > 0) {
					// All apps loaded from cache, update metadata
					await appCache.setMetadata(tenantUrl, userId, unchangedMetadata.map(a => a.id));
				}
			} else {
				// No cache available, load all apps
				loadAppDataInBackground();
			}
			
		} catch (err: any) {
			console.error('Failed to load app list:', err);
			dataLoadError = err.message || 'Failed to load apps from Qlik tenant';
		} finally {
			isLoadingApps = false;
		}
	}
	
	/**
	 * Check if an app matches the current space filter
	 */
	function appMatchesSpaceFilter(appSpaceId: string | undefined, currentSelectedSpaces: Set<string>): boolean {
		// If no spaces selected, all apps match
		if (currentSelectedSpaces.size === 0) return true;
		
		// Check if "Personal" is selected and app has no space
		const personalSelected = currentSelectedSpaces.has(PERSONAL_SPACE_ID);
		const appHasNoSpace = !appSpaceId;
		
		if (personalSelected && appHasNoSpace) return true;
		if (appSpaceId && currentSelectedSpaces.has(appSpaceId)) return true;
		
		return false;
	}
	
	async function loadAppDataInBackground(specificAppsToLoad?: AppItem[]) {
		if (isLoadingAppData || appItems.length === 0) return;
		
		isLoadingAppData = true;
		isLoadingPaused = false;
		isLoadingDismissed = false;
		loadingProgress = { current: qlikApps.length, total: appItems.length, currentApp: '' };
		
		try {
			const { qlikApi, tenantUrl } = await ensureAuthConfigured();
			const { qix } = qlikApi;
			
			const loadedAppIds = new Set(qlikApps.map(a => a.id));
			
			// Use specific apps if provided, otherwise determine from appItems
			// Also include any pending apps that were waiting (only when not using specific apps)
			let appsToLoad: AppItem[];
			if (specificAppsToLoad) {
				// When specific apps are provided (e.g., from resumeLoadingIfNeeded), only use those
				// Don't append pendingAppsToLoad as it may contain non-matching apps
				appsToLoad = specificAppsToLoad.filter(app => !loadedAppIds.has(app.resourceId));
			} else {
				appsToLoad = [...appItems, ...pendingAppsToLoad].filter(app => !loadedAppIds.has(app.resourceId));
			}
			
			// Deduplicate apps by resourceId
			const seenIds = new Set<string>();
			appsToLoad = appsToLoad.filter(app => {
				if (seenIds.has(app.resourceId)) return false;
				seenIds.add(app.resourceId);
				return true;
			});
			
			// Remove only the apps we're actually loading from pendingAppsToLoad
			// (don't clear the entire array as it may contain other apps that don't match the filter)
			const appsToLoadIds = new Set(appsToLoad.map(app => app.resourceId));
			pendingAppsToLoad = pendingAppsToLoad.filter(app => !appsToLoadIds.has(app.resourceId));
			
			if (appsToLoad.length === 0) {
				isLoadingAppData = false;
				loadingProgress = { current: appItems.length, total: appItems.length, currentApp: '' };
				
				// Update cache metadata even if nothing to load
				if (tenantUrl && currentUserId) {
					const allAppIds = qlikApps.map(a => a.id);
					await appCache.setMetadata(tenantUrl, currentUserId, allAppIds);
				}
				return;
			}
			
			const CONCURRENCY_LIMIT = 5;
			
			async function processApp(appItem: AppItem): Promise<'loaded' | 'skipped' | 'error'> {
				const appId = appItem.resourceId;
				const appName = appItem.name || appItem.resourceId;
				const appUpdatedAt = appItem.updatedAt;
				const appSpaceId = appItem.spaceId;
				
				// Check if app matches current space filter
				// Read selectedSpaces at processing time to get current state
				const currentSelectedSpaces = selectedSpaces;
				if (!appMatchesSpaceFilter(appSpaceId, currentSelectedSpaces)) {
					// App doesn't match filter - add to pending and skip
					pendingAppsToLoad = [...pendingAppsToLoad, appItem];
					return 'skipped';
				}
				
				if (loadingAppIds.has(appId)) return 'skipped';
				
				// Check again if already loaded (might have been loaded while waiting)
				if (qlikApps.find(a => a.id === appId)) return 'skipped';
				
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
										
					// Save full data to IndexedDB cache (for persistence)
					if (tenantUrl && currentUserId) {
						await appCache.setAppData(
							tenantUrl,
							currentUserId,
							appId,
							appName,
							structureData,
							appUpdatedAt,
							appSpaceId
						);
						
						// Store search items in IndexedDB (memory efficient)
						const itemCount = await storeAppSearchIndex(
							appId,
							appName,
							appSpaceId,
							structureData,
							tenantUrl,
							currentUserId
						);
						console.log(`Stored ${itemCount} search items for app ${appName}`);
					}
					
					// Only store lightweight metadata in memory, not full structure data
					const updatedApps = [...qlikApps, {
						id: appId,
						name: appName,
						spaceId: appSpaceId
					}];
					qlikApps = updatedApps;
					
					await processSheets(structureData, appName, appId);
					
					// Trigger search
					if (qlikApps.length > 0) {
						untrack(() => {
							performIndexedDBSearch();
						});
					}
					return 'loaded';
				} catch (err: any) {
					console.warn(`Failed to load app ${appName}:`, err);
					return 'error';
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
				const results = await Promise.all(batch.map((appItem: AppItem) => processApp(appItem)));
				
				// Count failed apps in this batch
				const batchFailed = results.filter(r => r === 'error').length;
				if (batchFailed > 0) {
					failedAppsCount += batchFailed;
				}
				
				// Check if all remaining apps are being skipped due to space filter
				// If so, pause loading and wait for filter to change
				if (pendingAppsToLoad.length > 0 && selectedSpaces.size > 0) {
					const remainingApps = appsToLoad.slice(i + CONCURRENCY_LIMIT);
					const loadedIds = new Set(qlikApps.map(a => a.id));
					const unloadedRemaining = remainingApps.filter(app => !loadedIds.has(app.resourceId));
					
					// Check if any remaining apps match the filter
					const matchingRemaining = unloadedRemaining.filter(app => 
						appMatchesSpaceFilter(app.spaceId, selectedSpaces)
					);
					
					if (matchingRemaining.length === 0 && unloadedRemaining.length > 0) {
						// All remaining apps are filtered out - add them to pending and pause
						pendingAppsToLoad = [...pendingAppsToLoad, ...unloadedRemaining];
						isLoadingPaused = true;
						console.log(`Loading paused: ${pendingAppsToLoad.length} apps waiting for space filter to change`);
						break;
					}
				}
			}
			
			// Update cache metadata after loading
			if (tenantUrl && currentUserId) {
				const allAppIds = qlikApps.map(a => a.id);
				await appCache.setMetadata(tenantUrl, currentUserId, allAppIds);
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
			const appUpdatedAt = appItem.updatedAt;
			const appSpaceId = appItem.spaceId;
			
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
			
			// Save to cache
			if (tenantUrl && currentUserId) {
				await appCache.setAppData(
					tenantUrl,
					currentUserId,
					appId,
					appName,
					structureData,
					appUpdatedAt,
					appSpaceId
				);
				
				// Store search items in IndexedDB
				await storeAppSearchIndex(
					appId,
					appName,
					appSpaceId,
					structureData,
					tenantUrl,
					currentUserId
				);
			}
			
			// Only store lightweight metadata in memory
			qlikApps = [...qlikApps, { id: appId, name: appName, spaceId: appSpaceId }];
			
			await processSheets(structureData, appName, appId);
			
			// Trigger search
			performIndexedDBSearch();
			
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
	
	/**
	 * Check for updates without clearing the cache - only loads new/changed apps
	 */
	async function checkForUpdates() {
		if (isLoadingApps || isLoadingAppData) return;
		
		// Reset loading state but keep existing data
		loadingAppIds = new Set();
		hasNewDataPending = false;
		failedAppsCount = 0;
		pendingAppsToLoad = [];
		isLoadingPaused = false;
		isLoadingDismissed = false;
		
		// Reset appItems to allow loadAppList to run
		// But keep qlikApps, sheets, etc. as they contain the cached data display
		appItems = [];
		
		// Re-run the app list load which will check for updates
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
				performIndexedDBSearch();
			}, 200);
		} else {
			// No apps loaded yet - clear results
			searchResults = [];
			unfilteredResults = [];
			totalSearchResults = 0;
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
			performIndexedDBSearch();
		}
		
		previousLoadingState = loading;
	});
	
	function refreshTable() {
		lastRefreshedAppsCount = qlikApps.length;
		hasNewDataPending = false;
		performIndexedDBSearch();
	}

	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	function handleSearchInput(value: string) {
		searchQuery = value;
		isSearching = true;
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		searchTimeout = setTimeout(() => {
			performIndexedDBSearch();
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
		
		// Check if we should resume loading paused apps
		resumeLoadingIfNeeded(newSet);
	}
	
	/**
	 * Resume loading paused apps if the new space filter allows them
	 */
	function resumeLoadingIfNeeded(newSelectedSpaces: Set<string>) {
		if (pendingAppsToLoad.length === 0 || isLoadingAppData) return;
		
		// Check if any pending apps now match the filter
		const matchingPending = pendingAppsToLoad.filter(app => 
			appMatchesSpaceFilter(app.spaceId, newSelectedSpaces)
		);
		
		if (matchingPending.length > 0) {
			console.log(`Resuming loading: ${matchingPending.length} pending apps now match the filter`);
			isLoadingPaused = false;
			// Resume background loading with the pending apps
			loadAppDataInBackground(matchingPending);
		}
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
		const newSet = new Set([PERSONAL_SPACE_ID, ...spaces.map((s) => s.id)]);
		selectedSpaces = newSet;
		resumeLoadingIfNeeded(newSet);
	}

	function deselectAllSpaces() {
		const newSet = new Set<string>();
		selectedSpaces = newSet;
		resumeLoadingIfNeeded(newSet);
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
						cachedCount={cacheLoadedAppsCount}
						isPaused={isLoadingPaused}
						pendingCount={pendingAppsToLoad.length}
						onRefreshTable={refreshTable}
					/>
				{:else if isLoadingPaused && pendingAppsToLoad.length > 0 && appItems.length > 0 && !isLoadingDismissed}
					<LoadingIndicator
						current={qlikApps.length}
						total={appItems.length}
						currentApp=""
						hasNewData={false}
						cachedCount={cacheLoadedAppsCount}
						isPaused={true}
						pendingCount={pendingAppsToLoad.length}
						onDismiss={() => isLoadingDismissed = true}
					/>
				{:else if !isLoadingAppData && !isLoadingApps && appItems.length > 0 && !isLoadingDismissed}
					<CompletionIndicator
						totalApps={qlikApps.length}
						expectedTotal={appItems.length}
						cachedCount={cacheLoadedAppsCount}
						failedCount={failedAppsCount}
						onCheckForUpdates={checkForUpdates}
						onDismiss={() => isLoadingDismissed = true}
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
