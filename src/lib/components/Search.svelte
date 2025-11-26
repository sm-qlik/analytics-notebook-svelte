<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, parseTenantUrl, createAuthConfig } from '$lib/utils/qlik-auth';
	import { EngineInterface } from '$lib/utils/engine-interface';
	import Fuse from 'fuse.js';
	import * as XLSX from 'xlsx';
	import FilterSidebar from './FilterSidebar.svelte';
	import SearchInput from './SearchInput.svelte';
	import SearchResultsTable from './SearchResultsTable.svelte';
	import LoadingIndicator from './LoadingIndicator.svelte';
	import CompletionIndicator from './CompletionIndicator.svelte';

	let searchQuery = $state('');
	let searchResults = $state([] as Array<{
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
	}>);
	let unfilteredResults = $state([] as Array<{
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
	}>);
	let isSearching = $state(false);
	let isLoadingApps = $state(false);
	let isLoadingAppData = $state(false);
	let dataLoadError = $state<string | null>(null);
	let loadingProgress = $state({ current: 0, total: 0, currentApp: '' });
	
	let qlikApps = $state<Array<{ id: string; name: string; data: any }>>([]);
	let apps = $state<Array<{ name: string; id: string }>>([]);
	let appItems = $state<Array<{ resourceId: string; name: string }>>([]);
	let sheets = $state<Array<{ name: string; app: string; appId: string; sheetId: string }>>([]);
	let loadingAppIds = $state<Set<string>>(new Set());
	
	function createNewSet(oldSet: Set<string>): Set<string> {
		return new Set(oldSet);
	}

	function getSheetNameFromId(sheetId: string | null): string | null {
		if (!sheetId) return null;
		const currentSheets = sheets;
		const sheet = currentSheets.find(s => s.sheetId === sheetId);
		return sheet ? sheet.name : null;
	}

	const availableSheets = $derived(
		Array.from(
			new Set(
				sheets
					.filter((sheet) => selectedApps.has(sheet.app))
					.map((sheet) => sheet.name)
			)
		).sort()
	);
	
	let selectedApps = $state(new Set<string>());
	let selectedSheets = $state(new Set<string>());
	let selectedTypes = $state(new Set<string>());
	
	const availableTypes = $derived(
		Array.from(new Set(unfilteredResults.map((r) => r.objectType).filter((t): t is string => Boolean(t)))).sort()
	);
	
	type SearchableItem = {
		path: string;
		object: any;
		objectType: string | null;
		context: any;
		file: string;
		app: string;
		sheet: string | null;
		sheetName: string | null;
		sheetId: string | null;
		chartId: string | null;
		searchableText: string;
	};

	let searchableIndex: SearchableItem[] = $state([]);
	let fuseInstance: Fuse<SearchableItem> | null = $state(null);

	function extractSearchableFields(obj: any): string {
		if (obj === null || obj === undefined) return '';
		
		const searchableFields: string[] = [];
		const fieldsToSearch = ['qFieldDefs', 'qFieldLabels', 'qLabelExpression', 'qAlias', 'title', 'qDef'];
		
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

	function buildSearchableIndex() {
		if (qlikApps.length === 0) {
			searchableIndex = [];
			fuseInstance = null;
			return;
		}
		
		const index: SearchableItem[] = [];
		const processedObjects = new Map<string, boolean>();

		function extractObjects(obj: any, path = '', context: any = {}, appId: string, appName: string, parentObj: any = null) {
			if (obj === null || obj === undefined) return;

			let inMasterDimensions = context.inMasterDimensions || false;
			let inMasterMeasures = context.inMasterMeasures || false;
			let inSheetDimensions = context.inSheetDimensions || false;
			let inSheetMeasures = context.inSheetMeasures || false;

			if (path === 'masterDimensions' || path.includes('masterDimensions[')) {
				inMasterDimensions = true;
			}
			if (path === 'masterMeasures' || path.includes('masterMeasures[')) {
				inMasterMeasures = true;
			}
			if (path === 'sheetDimensions' || path.includes('sheetDimensions[')) {
				inSheetDimensions = true;
			}
			if (path === 'sheetMeasures' || path.includes('sheetMeasures[')) {
				inSheetMeasures = true;
			}

			let inQdim = context.inQdim || false;
			let inQmeasure = context.inQmeasure || false;

			if (path.endsWith('.qDim') || path.includes('.qDim.')) {
				inQdim = true;
			}
			if (path.endsWith('.qMeasure') || path.includes('.qMeasure.')) {
				inQmeasure = true;
			}
			if (path.endsWith('.qDef') || path.includes('.qDef.')) {
				if (inSheetDimensions || path.includes('sheetDimensions[')) {
					inQdim = true;
				}
				if (inSheetMeasures || path.includes('sheetMeasures[')) {
					inQmeasure = true;
				}
			}

			let objectType: string | null = context.objectType || null;
			if (inQdim) {
				if (inMasterDimensions) {
					objectType = 'Master Dimension';
				} else if (inSheetDimensions) {
					objectType = 'Sheet Dimension';
				} else if (path.includes('masterDimensions')) {
					objectType = 'Master Dimension';
				} else if (path.includes('sheetDimensions')) {
					objectType = 'Sheet Dimension';
				} else {
					objectType = 'Sheet Dimension';
				}
			} else if (inQmeasure) {
				if (inMasterMeasures) {
					objectType = 'Master Measure';
				} else if (inSheetMeasures) {
					objectType = 'Sheet Measure';
				} else if (path.includes('masterMeasures')) {
					objectType = 'Master Measure';
				} else if (path.includes('sheetMeasures')) {
					objectType = 'Sheet Measure';
				} else {
					objectType = 'Sheet Measure';
				}
			}

			let sheetId = context.sheetId;
			let sheetName = context.sheetName;

			if ((inSheetDimensions || inSheetMeasures) && typeof obj === 'object' && obj !== null && 'sheetId' in obj) {
				sheetId = obj.sheetId;
				if (sheetId) {
					sheetName = getSheetNameFromId(sheetId);
				}
			}

			const newContext = {
				...context,
				inQdim,
				inQmeasure,
				inMasterDimensions,
				inMasterMeasures,
				inSheetDimensions: inSheetDimensions || context.inSheetDimensions || false,
				inSheetMeasures: inSheetMeasures || context.inSheetMeasures || false,
				objectType: objectType || context.objectType || null,
				sheetName: sheetName || context.sheetName,
				sheetId: sheetId || context.sheetId
			};

			const isQdimObject = (path.endsWith('.qDim') || (path.endsWith('.qDef') && inSheetDimensions)) && typeof obj === 'object';
			const isQmeasureObject = (path.endsWith('.qMeasure') || (path.endsWith('.qDef') && inSheetMeasures)) && typeof obj === 'object';

			if (isQdimObject || isQmeasureObject) {
				const objectPath = path;
				if (!processedObjects.has(objectPath)) {
					processedObjects.set(objectPath, true);
					const searchableText = extractSearchableFields(obj);
					let chartId = null;
					if (parentObj && typeof parentObj === 'object' && parentObj.qInfo?.qId) {
						chartId = parentObj.qInfo.qId;
					} else if (typeof obj === 'object' && obj !== null && obj.qInfo?.qId) {
						chartId = obj.qInfo.qId;
					}
					index.push({
						path: objectPath,
						object: obj,
						objectType: newContext.objectType,
						context: newContext,
						file: appId,
						app: appName,
						sheet: sheetName || null,
						sheetName: sheetName || null,
						sheetId: newContext.sheetId || null,
						sheetUrl: newContext.sheetUrl || null,
						chartId: chartId,
						chartTitle: newContext.chartTitle || null,
						chartUrl: newContext.chartUrl || null,
						searchableText
					});
				}
				return;
			}

			if (Array.isArray(obj)) {
				obj.forEach((item, index) => {
					let itemContext = newContext;
					if (path === 'sheets' && item?.qProperty?.qMetaDef?.title) {
						itemContext = {
							...newContext,
							sheetName: item.qProperty.qMetaDef.title,
							sheetId: item.qProperty.qInfo?.qId
						};
					} else if ((path === 'sheetDimensions' || path === 'sheetMeasures') && item?.sheetId) {
						const itemSheetName = getSheetNameFromId(item.sheetId) || null;
						itemContext = {
							...newContext,
							sheetName: itemSheetName,
							sheetId: item.sheetId,
							inSheetDimensions: path === 'sheetDimensions',
							inSheetMeasures: path === 'sheetMeasures'
						};
					}
					extractObjects(item, `${path}[${index}]`, itemContext, appId, appName, item);
				});
			} else if (typeof obj === 'object' && obj !== null) {
				Object.keys(obj).forEach((key) => {
					const newPath = path ? `${path}.${key}` : key;
					extractObjects(obj[key], newPath, newContext, appId, appName, obj);
				});
			}
		}

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
			
			appStructure.masterDimensions.forEach((dim: any, index: number) => {
				if (dim.qDim) {
					extractObjects(
						dim.qDim,
						`masterDimensions[${index}].qDim`,
						{ appName, appId, inMasterDimensions: true, inQdim: true },
						appId,
						appName,
						dim
					);
				}
			});
			
			appStructure.masterMeasures.forEach((measure: any, index: number) => {
				if (measure.qMeasure) {
					extractObjects(
						measure.qMeasure,
						`masterMeasures[${index}].qMeasure`,
						{ appName, appId, inMasterMeasures: true, inQmeasure: true },
						appId,
						appName,
						measure
					);
				}
			});
			
			appStructure.sheetDimensions.forEach((dim: any, index: number) => {
				const sheetId = dim.sheetId;
				const sheetName = dim.sheetTitle || getSheetNameFromId(sheetId) || null;
				const sheetUrl = dim.sheetUrl || null;
				const chartTitle = dim.chartTitle || null;
				const chartUrl = dim.chartUrl || null;
				
				if (dim.qDef) {
					extractObjects(
						dim.qDef,
						`sheetDimensions[${index}].qDef`,
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
						dim
					);
				} else if (dim.qLibraryId) {
					const libraryDim = appStructure.masterDimensions.find((d: any) => d.qInfo?.qId === dim.qLibraryId);
					if (libraryDim?.qDim) {
						extractObjects(
							libraryDim.qDim,
							`sheetDimensions[${index}].qDef`,
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
							dim
						);
					}
				}
			});
			
			appStructure.sheetMeasures.forEach((measure: any, index: number) => {
				const sheetId = measure.sheetId;
				const sheetName = measure.sheetTitle || getSheetNameFromId(sheetId) || null;
				const sheetUrl = measure.sheetUrl || null;
				const chartTitle = measure.chartTitle || null;
				const chartUrl = measure.chartUrl || null;
				
				if (measure.qDef) {
					extractObjects(
						measure.qDef,
						`sheetMeasures[${index}].qDef`,
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
						measure
					);
				} else if (measure.qLibraryId) {
					const libraryMeasure = appStructure.masterMeasures.find((m: any) => m.qInfo?.qId === measure.qLibraryId);
					if (libraryMeasure?.qMeasure) {
						extractObjects(
							libraryMeasure.qMeasure,
							`sheetMeasures[${index}].qDef`,
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
							measure
						);
					}
				}
			});
		});

		searchableIndex = index;

		fuseInstance = new Fuse(index, {
			keys: ['searchableText', 'path', 'app', 'sheetName', 'objectType'],
			threshold: 0.3,
			includeScore: true,
			minMatchCharLength: 1
		});
	}

	async function loadAppList() {
		if (isLoadingApps || appItems.length > 0) return;
		
		isLoadingApps = true;
		dataLoadError = null;
		
		try {
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
			const tenantInfo = parseTenantUrl(tenantUrl);
			const qlikApi = await loadQlikAPI();
			const { auth, items } = qlikApi;
			
			const authConfig = createAuthConfig(tenantInfo);
			auth.setDefaultHostConfig(authConfig);
			
			const itemsResponse = await items.getItems();
			if (itemsResponse.status !== 200) {
				throw new Error(`Failed to get items: ${itemsResponse.status}`);
			}
			
			const allApps = itemsResponse.data?.data || [];
			appItems = allApps;
			apps = allApps.map((app: any) => ({
				name: app.name || app.resourceId,
				id: app.resourceId
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
			const authState = authStore;
			let currentAuthState: any = null;
			const unsubscribe = authState.subscribe(state => {
				currentAuthState = state;
			});
			unsubscribe();
			
			if (!currentAuthState?.isAuthenticated || !currentAuthState?.tenantUrl) {
				return;
			}
			
			const tenantUrl = currentAuthState.tenantUrl;
			const qlikApi = await loadQlikAPI();
			const { qix } = qlikApi;
			
			const loadedAppIds = new Set(qlikApps.map(a => a.id));
			const appsToLoad = appItems.filter(app => !loadedAppIds.has(app.resourceId));
			
			if (appsToLoad.length === 0) {
				isLoadingAppData = false;
				loadingProgress = { current: appItems.length, total: appItems.length, currentApp: '' };
				return;
			}
			
			const CONCURRENCY_LIMIT = 3;
			
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
				
				try {
					const session = await qix.openAppSession({ appId });
					const app = await session.getDoc();
					const structureData = await EngineInterface.fetchAppStructureData(app, tenantUrl, appId);
					
					const updatedApps = [...qlikApps, {
						id: appId,
						name: appName,
						data: structureData
					}];
					qlikApps = updatedApps;
					
					if (structureData.sheets && Array.isArray(structureData.sheets)) {
						const newSheets: Array<{ name: string; app: string; appId: string; sheetId: string }> = [];
						structureData.sheets.forEach((sheet: any) => {
							const sheetTitle = sheet?.qProperty?.qMetaDef?.title;
							if (sheetTitle) {
								newSheets.push({
									name: sheetTitle,
									app: appName,
									appId: appId,
									sheetId: sheet?.qProperty?.qInfo?.qId || ''
								});
							}
						});
						sheets = [...sheets, ...newSheets];
					}
					await session.close();
					buildSearchableIndex();
				} catch (err: any) {
					console.warn(`Failed to load app ${appName}:`, err);
				} finally {
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
		
		try {
			const authState = authStore;
			let currentAuthState: any = null;
			const unsubscribe = authState.subscribe(state => {
				currentAuthState = state;
			});
			unsubscribe();
			
			if (!currentAuthState?.isAuthenticated || !currentAuthState?.tenantUrl) {
				return;
			}
			
			const tenantUrl = currentAuthState.tenantUrl;
			const qlikApi = await loadQlikAPI();
			const { qix } = qlikApi;
			
			const appName = appItem.name || appId;
			loadingAppIds = new Set([...loadingAppIds, appId]);
			loadingProgress = { 
				current: qlikApps.length, 
				total: appItems.length, 
				currentApp: appName 
			};
			
			const session = await qix.openAppSession({ appId });
			const app = await session.getDoc();
			const structureData = await EngineInterface.fetchAppStructureData(app, tenantUrl, appId);
			
			qlikApps = [...qlikApps, { id: appId, name: appName, data: structureData }];
			
			if (structureData.sheets && Array.isArray(structureData.sheets)) {
				const newSheets: Array<{ name: string; app: string; appId: string; sheetId: string }> = [];
				structureData.sheets.forEach((sheet: any) => {
					const sheetTitle = sheet?.qProperty?.qMetaDef?.title;
					if (sheetTitle) {
						newSheets.push({
							name: sheetTitle,
							app: appName,
							appId: appId,
							sheetId: sheet?.qProperty?.qInfo?.qId || ''
						});
					}
				});
				sheets = [...sheets, ...newSheets];
			}
			await session.close();
			buildSearchableIndex();
			
			const newLoadingIds = new Set(loadingAppIds);
			newLoadingIds.delete(appId);
			loadingAppIds = newLoadingIds;
			loadingProgress = { 
				current: qlikApps.length, 
				total: appItems.length, 
				currentApp: '' 
			};
			
			loadAppDataInBackground();
			
		} catch (err: any) {
			console.warn(`Failed to load app ${appId}:`, err);
			const newLoadingIds = new Set(loadingAppIds);
			newLoadingIds.delete(appId);
			loadingAppIds = newLoadingIds;
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
		
		selectedApps = new Set();
		selectedSheets = new Set();
		selectedTypes = new Set();
		
		await loadAppList();
	}
	
	onMount(() => {
		const unsubscribe = authStore.subscribe(state => {
			if (state.isAuthenticated && appItems.length === 0 && !isLoadingApps) {
				loadAppList();
			}
		});
		return unsubscribe;
	});

	function performSearch() {
		isSearching = true;
		const query = searchQuery.trim();
		const hasQuery = query.length > 0;
		
		const hasAppSelections = selectedApps.size > 0;
		const hasSheetSelections = selectedSheets.size > 0;
		const hasTypeSelections = selectedTypes.size > 0;
		
		const allAppsSelected = hasAppSelections && selectedApps.size === apps.length;
		const allSheetsSelected = hasSheetSelections && availableSheets.length > 0 && selectedSheets.size >= availableSheets.length;
		const allTypesSelected = hasTypeSelections && selectedTypes.size === typeOptions.length;
		
		const hasAppFilters = hasAppSelections && !allAppsSelected;
		const hasSheetFilters = hasSheetSelections && (!hasAppSelections || !allSheetsSelected);
		const hasTypeFilters = hasTypeSelections && !allTypesSelected;
		
		const hasAnySelections = hasAppSelections || hasSheetSelections || hasTypeSelections;

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
		
		const allResults: typeof searchResults = [];
		unfilteredResults = [];
		
		for (const item of candidateResults) {
			const sheetName = item.sheetName || item.sheet;

			if (hasAppFilters && !selectedApps.has(item.app)) {
				continue;
			}

			if (hasSheetFilters) {
				if (!sheetName || sheetName === 'N/A') {
					continue;
				}
				if (!selectedSheets.has(sheetName)) {
					continue;
				}
			}

				unfilteredResults.push({
					path: item.path,
					object: item.object,
					objectType: item.objectType,
					context: item.context,
					file: item.file,
					app: item.app,
					sheet: sheetName,
					sheetName: sheetName,
					sheetUrl: item.sheetUrl || null,
					chartTitle: item.chartTitle || null,
					chartUrl: item.chartUrl || null
				});			if (hasTypeFilters) {
				if (!item.objectType) {
					continue;
				}
				if (!selectedTypes.has(item.objectType)) {
					continue;
				}
			}

		allResults.push({
			path: item.path,
			object: item.object,
			objectType: item.objectType,
			context: item.context,
			file: item.file,
			app: item.app,
			sheet: sheetName,
			sheetName: sheetName,
			sheetId: item.sheetId || null,
			sheetUrl: item.sheetUrl || null,
			chartId: item.chartId || null,
			chartTitle: item.chartTitle || null,
			chartUrl: item.chartUrl || null
		});
	}		searchResults = allResults;
		isSearching = false;
	}

	const typeOptions = ['Master Measure', 'Master Dimension', 'Sheet Measure', 'Sheet Dimension'];
	
	let searchEffectTimeout: ReturnType<typeof setTimeout> | null = null;
	
	$effect(() => {
		const query = searchQuery;
		const appsSize = selectedApps.size;
		const sheetsSize = selectedSheets.size;
		const typesSize = selectedTypes.size;
		const qlikAppsLength = qlikApps.length;
		
		if (searchEffectTimeout) {
			clearTimeout(searchEffectTimeout);
		}
		
		const hasQuery = searchQuery.trim().length > 0;
		const hasSelections = selectedApps.size > 0 || selectedSheets.size > 0 || selectedTypes.size > 0;
		
		if (hasQuery || hasSelections || qlikApps.length > 0) {
			isSearching = true;
			searchEffectTimeout = setTimeout(() => {
				performSearch();
			}, 200);
		} else {
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

	function toggleApp(appName: string) {
		const newSet = createNewSet(selectedApps);
		const wasSelected = newSet.has(appName);
		
		if (wasSelected) {
			newSet.delete(appName);
			const sheetsToRemove = sheets
				.filter((sheet) => sheet.app === appName)
				.map((sheet) => sheet.name);
			const newSheetsSet = createNewSet(selectedSheets);
			sheetsToRemove.forEach((sheetName) => newSheetsSet.delete(sheetName));
			selectedSheets = newSheetsSet;
		} else {
			newSet.add(appName);
			const app = apps.find(a => a.name === appName);
			if (app) {
				loadAppDataPriority(app.id);
			}
		}
		selectedApps = newSet;
	}

	function toggleSheet(sheetName: string) {
		const newSet = createNewSet(selectedSheets);
		if (newSet.has(sheetName)) {
			newSet.delete(sheetName);
		} else {
			newSet.add(sheetName);
		}
		selectedSheets = newSet;
	}

	function selectAllApps() {
		selectedApps = new Set(apps.map((a) => a.name));
		apps.forEach(app => {
			loadAppDataPriority(app.id);
		});
	}

	function deselectAllApps() {
		selectedApps = new Set();
		selectedSheets = new Set();
	}

	function selectAllSheets() {
		selectedSheets = new Set(availableSheets);
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

		return {
			Title: title,
			Definition: definition,
			App: result.app,
			Sheet: sheetName,
			Type: result.objectType || 'N/A',
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

<div class="w-full flex-1 flex min-h-0 gap-4">
	<FilterSidebar
		{apps}
		{availableSheets}
		{availableTypes}
		{selectedApps}
		{selectedSheets}
		{selectedTypes}
		onToggleApp={toggleApp}
		onToggleSheet={toggleSheet}
		onToggleType={toggleType}
		onSelectAllApps={selectAllApps}
		onDeselectAllApps={deselectAllApps}
		onSelectAllSheets={selectAllSheets}
		onDeselectAllSheets={deselectAllSheets}
		onSelectAllTypes={selectAllTypes}
		onDeselectAllTypes={deselectAllTypes}
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
			{#if isLoadingAppData && appItems.length > 0}
				<LoadingIndicator
					current={loadingProgress.current}
					total={loadingProgress.total}
					currentApp={loadingProgress.currentApp}
				/>
			{:else if !isLoadingAppData && !isLoadingApps && appItems.length > 0 }
				<CompletionIndicator
					totalApps={appItems.length}
					onRefresh={refreshData}
				/>
			{/if}
			
			<SearchInput
				value={searchQuery}
				{isSearching}
				onInput={handleSearchInput}
			/>
		
			{#if isSearching}
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
					{searchQuery}
					onExportToExcel={exportToExcel}
					onCopyToClipboard={copyToClipboard}
					copiedDefinitionId={copiedDefinitionId}
				/>
			{/if}
		{/if}
	</div>
</div>
