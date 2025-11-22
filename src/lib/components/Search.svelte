<script lang="ts">
	// Import all JSON data files
	import appAnalyzer from '$lib/data/AppAnalyzer.json';
	import automationAnalyzer from '$lib/data/AutomationAnalyzer.json';
	import managerPeopleAnalytics from '$lib/data/ManagerPeopleAnalytics.json';
	import reloadAnalyzer from '$lib/data/ReloadAnalyzer.json';
	import QDimMeasureResult from './QDimMeasureResult.svelte';
	import Fuse from 'fuse.js';
	import * as XLSX from 'xlsx';

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
		chartId?: string | null;
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
		chartId?: string | null;
	}>);
	let isSearching = $state(false);
	
	// Helper to create a new Set for reactivity
	function createNewSet(oldSet: Set<string>) {
		return new Set(oldSet);
	}

	// Map of file names to their data
	const dataFiles = {
		'AppAnalyzer.json': appAnalyzer,
		'AutomationAnalyzer.json': automationAnalyzer,
		'ManagerPeopleAnalytics.json': managerPeopleAnalytics,
		'ReloadAnalyzer.json': reloadAnalyzer
	};

	// Extract apps and sheets from data
	function extractAppsAndSheets() {
		const apps = [];
		const sheets = [];

		Object.entries(dataFiles).forEach(([fileName, data]) => {
			const appName = data?.appLayout?.qTitle || fileName;
			apps.push({ name: appName, file: fileName });

			if (data?.sheets && Array.isArray(data.sheets)) {
				data.sheets.forEach((sheet) => {
					const sheetTitle = sheet?.qProperty?.qMetaDef?.title;
					if (sheetTitle) {
						sheets.push({
							name: sheetTitle,
							app: appName,
							appFile: fileName,
							sheetId: sheet?.qProperty?.qInfo?.qId
						});
					}
				});
			}
		});

		return { apps, sheets };
	}

	const { apps, sheets } = extractAppsAndSheets();

	// Create a map of sheetId to sheet name for quick lookup
	const sheetIdToNameMap = new Map<string, string>();
	sheets.forEach((sheet) => {
		if (sheet.sheetId) {
			sheetIdToNameMap.set(sheet.sheetId, sheet.name);
		}
	});

	// Get unique sheet names
	const uniqueSheets = Array.from(new Set(sheets.map((s) => s.name))).sort();

	// Initialize with nothing selected
	let selectedApps = $state(new Set<string>());
	let selectedSheets = $state(new Set<string>());
	
	// Get available sheets based on selected apps
	const availableSheets = $derived(
		Array.from(
			new Set(
				sheets
					.filter((sheet) => selectedApps.has(sheet.app))
					.map((sheet) => sheet.name)
			)
		).sort()
	);
	
	// Type filter options
	const typeOptions = [
		'Master Measure',
		'Master Dimension',
		'Sheet Measure',
		'Sheet Dimension'
	];
	let selectedTypes = $state(new Set<string>());
	
	// Collapse/expand state for filter categories
	let appsExpanded = $state(true);
	let sheetsExpanded = $state(true);
	let typesExpanded = $state(true);
	
	// Get available types from unfiltered results (filtered by app/sheet but not by type)
	const availableTypes = $derived(
		Array.from(new Set(unfilteredResults.map((r) => r.objectType).filter((t): t is string => Boolean(t)))).sort()
	);
	
	// Build searchable index of all qDim and qMeasure objects
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
		searchableText: string; // Flattened text for Fuse.js to search
	};

	let searchableIndex: SearchableItem[] = $state([]);
	let fuseInstance: Fuse<SearchableItem> | null = $state(null);

	// Extract only specific searchable fields from an object
	function extractSearchableFields(obj: any): string {
		if (obj === null || obj === undefined) return '';
		
		const searchableFields: string[] = [];
		const fieldsToSearch = ['qFieldDefs', 'qFieldLabels', 'qLabelExpression', 'qAlias', 'title', 'qDef'];
		
		// Helper to flatten a value into a string
		function flattenValue(value: any): string {
			if (value === null || value === undefined) return '';
			if (typeof value === 'string') return value;
			if (typeof value === 'number' || typeof value === 'boolean') return String(value);
			if (Array.isArray(value)) {
				return value.map(item => flattenValue(item)).filter(Boolean).join(' ');
			}
			if (typeof value === 'object') {
				// For nested objects, recursively extract searchable fields
				return Object.entries(value)
					.map(([key, val]) => flattenValue(val))
					.filter(Boolean)
					.join(' ');
			}
			return '';
		}
		
		// Extract only the specified fields
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

	// Extract all qDim and qMeasure objects from data (run once on initialization)
	function buildSearchableIndex() {
		const index: SearchableItem[] = [];
		const processedObjects = new Map<string, boolean>();

		function extractObjects(obj: any, path = '', context: any = {}, fileName: string, appName: string, parentObj: any = null) {
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
				// Determine if it's a Master or Sheet dimension based on context
				if (inMasterDimensions) {
					objectType = 'Master Dimension';
				} else if (inSheetDimensions) {
					objectType = 'Sheet Dimension';
				} else {
					// Fallback: if we're in a qDim but not in masterDimensions or sheetDimensions,
					// check the path to determine
					if (path.includes('masterDimensions')) {
						objectType = 'Master Dimension';
					} else if (path.includes('sheetDimensions')) {
						objectType = 'Sheet Dimension';
					} else {
						objectType = 'Sheet Dimension'; // Default fallback
					}
				}
			} else if (inQmeasure) {
				// Determine if it's a Master or Sheet measure based on context
				if (inMasterMeasures) {
					objectType = 'Master Measure';
				} else if (inSheetMeasures) {
					objectType = 'Sheet Measure';
				} else {
					// Fallback: if we're in a qMeasure but not in masterMeasures or sheetMeasures,
					// check the path to determine
					if (path.includes('masterMeasures')) {
						objectType = 'Master Measure';
					} else if (path.includes('sheetMeasures')) {
						objectType = 'Sheet Measure';
					} else {
						objectType = 'Sheet Measure'; // Default fallback
					}
				}
			}

			let sheetId = context.sheetId;
			let sheetName = context.sheetName;

			if ((inSheetDimensions || inSheetMeasures) && typeof obj === 'object' && obj !== null && 'sheetId' in obj) {
				sheetId = obj.sheetId;
				if (sheetId && sheetIdToNameMap.has(sheetId)) {
					sheetName = sheetIdToNameMap.get(sheetId);
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
					// Try to get chart/dimension ID from parent object (qInfo is at parent level)
					// When path is like "masterDimensions[0].qDim", parentObj is masterDimensions[0] which has qInfo
					let chartId = null;
					if (parentObj && typeof parentObj === 'object' && parentObj.qInfo?.qId) {
						chartId = parentObj.qInfo.qId;
					} else if (typeof obj === 'object' && obj !== null && obj.qInfo?.qId) {
						// Fallback: check if qInfo exists in the object itself
						chartId = obj.qInfo.qId;
					}
					index.push({
						path: objectPath,
						object: obj,
						objectType: newContext.objectType,
						context: newContext,
						file: fileName,
						app: appName,
						sheet: sheetName || null,
						sheetName: sheetName || null,
						sheetId: newContext.sheetId || null,
						chartId: chartId,
						searchableText
					});
				}
				return; // Don't recurse into the object itself
			}

			// Continue traversing
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
						const itemSheetName = sheetIdToNameMap.get(item.sheetId) || null;
						itemContext = {
							...newContext,
							sheetName: itemSheetName,
							sheetId: item.sheetId,
							inSheetDimensions: path === 'sheetDimensions',
							inSheetMeasures: path === 'sheetMeasures'
						};
					}
					// Pass the item as parent when traversing into it
					extractObjects(item, `${path}[${index}]`, itemContext, fileName, appName, item);
				});
			} else if (typeof obj === 'object' && obj !== null) {
				Object.keys(obj).forEach((key) => {
					const newPath = path ? `${path}.${key}` : key;
					// Pass obj as parent when traversing into its properties
					extractObjects(obj[key], newPath, newContext, fileName, appName, obj);
				});
			}
		}

		// Extract from all files
		Object.entries(dataFiles).forEach(([fileName, data]) => {
			const appName = getAppName(fileName);
			extractObjects(data, '', { appName, fileName }, fileName, appName, null);
		});

		searchableIndex = index;

		// Initialize Fuse.js with the index
		fuseInstance = new Fuse(index, {
			keys: ['searchableText', 'path', 'app', 'sheetName', 'objectType'],
			threshold: 0.3, // 0.0 = exact match, 1.0 = match anything
			includeScore: true,
			minMatchCharLength: 1
		});
	}

	// Initialize the searchable index on component mount
	$effect(() => {
		if (searchableIndex.length === 0) {
			buildSearchableIndex();
		}
	});

	// Deep search function that searches through nested objects (DEPRECATED - kept for reference)
	/*function deepSearch(obj, query, path = '', context = {}) {
		const results = [];
		const queryLower = query ? query.toLowerCase() : '';
		const hasQuery = query && query.trim().length > 0;
		const processedObjects = new Map(); // Track processed qDim/qMeasure objects

		function searchRecursive(current, currentPath, currentContext, parentObject = null, parentPath = '') {
			if (current === null || current === undefined) {
				return false; // Return whether we found a match
			}

			// Track if we're inside masterDimensions or masterMeasures arrays
			let inMasterDimensions = currentContext.inMasterDimensions || false;
			let inMasterMeasures = currentContext.inMasterMeasures || false;
			let inSheetDimensions = currentContext.inSheetDimensions || false;
			let inSheetMeasures = currentContext.inSheetMeasures || false;
			
			if (currentPath === 'masterDimensions' || currentPath.includes('masterDimensions[')) {
				inMasterDimensions = true;
			}
			if (currentPath === 'masterMeasures' || currentPath.includes('masterMeasures[')) {
				inMasterMeasures = true;
			}
			if (currentPath === 'sheetDimensions' || currentPath.includes('sheetDimensions[')) {
				inSheetDimensions = true;
			}
			if (currentPath === 'sheetMeasures' || currentPath.includes('sheetMeasures[')) {
				inSheetMeasures = true;
			}

			// Track if we're inside a qDim or qMeasure object
			let inQdim = currentContext.inQdim || false;
			let inQmeasure = currentContext.inQmeasure || false;
			
			if (currentPath.endsWith('.qDim') || currentPath.includes('.qDim.')) {
				inQdim = true;
			}
			if (currentPath.endsWith('.qMeasure') || currentPath.includes('.qMeasure.')) {
				inQmeasure = true;
			}
			
			// Also check if we're in qDef within sheetDimensions or sheetMeasures
			if (currentPath.endsWith('.qDef') || currentPath.includes('.qDef.')) {
				if (inSheetDimensions || currentPath.includes('sheetDimensions[')) {
					inQdim = true;
				}
				if (inSheetMeasures || currentPath.includes('sheetMeasures[')) {
					inQmeasure = true;
				}
			}

			// Check if we're entering a qDim or qMeasure object
			let isQdimObject = false;
			let isQmeasureObject = false;
			let qdimPath = '';
			let qmeasurePath = '';
			
			if (currentPath.endsWith('.qDim') && typeof current === 'object') {
				isQdimObject = true;
				qdimPath = currentPath;
			}
			if (currentPath.endsWith('.qMeasure') && typeof current === 'object') {
				isQmeasureObject = true;
				qmeasurePath = currentPath;
			}
			
			// Check if we're entering a qDef object within sheetDimensions or sheetMeasures
			// Check both the current path and the context to determine if we're in sheetDimensions/sheetMeasures
			const isInSheetDimensionsPath = currentPath.includes('sheetDimensions[') || currentContext.inSheetDimensions;
			const isInSheetMeasuresPath = currentPath.includes('sheetMeasures[') || currentContext.inSheetMeasures;
			
			if (currentPath.endsWith('.qDef') && typeof current === 'object') {
				if (isInSheetDimensionsPath) {
					isQdimObject = true;
					qdimPath = currentPath;
				}
				if (isInSheetMeasuresPath) {
					isQmeasureObject = true;
					qmeasurePath = currentPath;
				}
			}

			// Determine the type based on context
			let objectType = currentContext.objectType || null;
			if (inQdim) {
				objectType = inMasterDimensions ? 'Master Dimension' : 'Sheet Dimension';
			} else if (inQmeasure) {
				objectType = inMasterMeasures ? 'Master Measure' : 'Sheet Measure';
			}

			// Extract sheetId from parent object if we're in sheetDimensions or sheetMeasures
			let sheetId = currentContext.sheetId;
			let sheetName = currentContext.sheetName;
			
			// If we're inside a sheetDimensions or sheetMeasures item, try to get sheetId from parent
			if ((inSheetDimensions || inSheetMeasures) && parentObject && typeof parentObject === 'object') {
				if (parentObject.sheetId) {
					sheetId = parentObject.sheetId;
					// Look up sheet name from sheetId using the global map
					if (sheetIdToNameMap.has(sheetId)) {
						sheetName = sheetIdToNameMap.get(sheetId);
					}
				}
			}

			// Always preserve sheet context from parent
			const newContext = { 
				...currentContext, 
				inQdim, 
				inQmeasure,
				inMasterDimensions,
				inMasterMeasures,
				inSheetDimensions: inSheetDimensions || currentContext.inSheetDimensions || false,
				inSheetMeasures: inSheetMeasures || currentContext.inSheetMeasures || false,
				objectType: objectType || currentContext.objectType || null,
				// Preserve or update sheetName and sheetId
				sheetName: sheetName || currentContext.sheetName,
				sheetId: sheetId || currentContext.sheetId
			};

			// If we found a qDim or qMeasure object, check if it matches
			if (isQdimObject || isQmeasureObject) {
				const objectPath = isQdimObject ? qdimPath : qmeasurePath;
				
				// Skip if we've already processed this object
				if (processedObjects.has(objectPath)) {
					return false;
				}

				// Search within this object for matches
				let hasMatch = false;
				if (!hasQuery) {
					hasMatch = true; // If no query, include all objects
				} else {
					hasMatch = searchObjectForMatch(current, queryLower);
				}

				if (hasMatch && shouldIncludeResult(objectPath, newContext)) {
					processedObjects.set(objectPath, true);
					// Ensure sheetName is preserved in the context
					// newContext already has sheetName from currentContext via spread operator
					results.push({
						path: objectPath,
						object: current,
						objectType: newContext.objectType,
						context: { ...newContext } // This should include sheetName if it was in currentContext
					});
					return true; // Found match, can skip further searching in this object
				}
				return false;
			}

			// Continue searching recursively
			let foundMatch = false;
			if (typeof current === 'string') {
				if (hasQuery && current.toLowerCase().includes(queryLower)) {
					foundMatch = true;
				} else if (!hasQuery) {
					foundMatch = true;
				}
			} else if (typeof current === 'number' || typeof current === 'boolean') {
				const strValue = String(current);
				if (hasQuery && strValue.toLowerCase().includes(queryLower)) {
					foundMatch = true;
				} else if (!hasQuery) {
					foundMatch = true;
				}
			} else if (Array.isArray(current)) {
				current.forEach((item, index) => {
					let sheetContext = currentContext;
					// Check if we're entering the 'sheets' array
					if (currentPath === 'sheets' && item?.qProperty?.qMetaDef?.title) {
						sheetContext = {
							...currentContext,
							sheetName: item.qProperty.qMetaDef.title,
							sheetId: item.qProperty.qInfo?.qId
						};
					} else if ((currentPath === 'sheetDimensions' || currentPath === 'sheetMeasures') && item?.sheetId) {
						// When entering sheetDimensions or sheetMeasures items, extract sheetId
						let itemSheetName = null;
						if (item.sheetId && sheetIdToNameMap.has(item.sheetId)) {
							itemSheetName = sheetIdToNameMap.get(item.sheetId);
						}
						sheetContext = {
							...currentContext,
							sheetName: itemSheetName,
							sheetId: item.sheetId,
							inSheetDimensions: currentPath === 'sheetDimensions',
							inSheetMeasures: currentPath === 'sheetMeasures'
						};
					} else {
						// Always preserve sheet context when traversing arrays within sheets
						sheetContext = {
							...currentContext,
							sheetName: currentContext.sheetName,
							sheetId: currentContext.sheetId
						};
					}
					if (searchRecursive(item, `${currentPath}[${index}]`, sheetContext, current, currentPath)) {
						foundMatch = true;
					}
				});
			} else if (typeof current === 'object') {
				// Ensure we preserve inSheetDimensions and inSheetMeasures when traversing objects
				const contextForObject = {
					...newContext,
					inSheetDimensions: newContext.inSheetDimensions || currentContext.inSheetDimensions || false,
					inSheetMeasures: newContext.inSheetMeasures || currentContext.inSheetMeasures || false
				};
				Object.keys(current).forEach((key) => {
					const newPath = currentPath ? `${currentPath}.${key}` : key;
					if (searchRecursive(current[key], newPath, contextForObject, current, currentPath)) {
						foundMatch = true;
					}
				});
			}

			return foundMatch;
		}

		searchRecursive(obj, path, context);
		return results;
	}*/

	// Helper function to search an object for matches (optimized with early exit)
	/*function searchObjectForMatch(obj, queryLower) {
		if (typeof obj === 'string') {
			return obj.toLowerCase().includes(queryLower);
		}
		if (typeof obj === 'number' || typeof obj === 'boolean') {
			return String(obj).toLowerCase().includes(queryLower);
		}
		if (Array.isArray(obj)) {
			// Use for loop for early exit instead of .some() for better performance
			for (let i = 0; i < obj.length; i++) {
				if (searchObjectForMatch(obj[i], queryLower)) {
					return true;
				}
			}
			return false;
		}
		if (typeof obj === 'object' && obj !== null) {
			// Use for...in for early exit instead of Object.values().some()
			for (const key in obj) {
				if (Object.prototype.hasOwnProperty.call(obj, key)) {
					if (searchObjectForMatch(obj[key], queryLower)) {
						return true;
					}
				}
			}
			return false;
		}
		return false;
	}*/

	// Check if result should be included based on filters
	function shouldIncludeResult(path, context) {
		// Include results from qdim or qmeasure objects only
		if (!context.inQdim && !context.inQmeasure) {
			return false;
		}

		return true;
	}


	// Get app name from file name
	function getAppName(fileName) {
		const app = apps.find((a) => a.file === fileName);
		return app ? app.name : fileName;
	}

	// Get sheet name from path context
	function getSheetNameFromPath(path, fileName) {
		// Try to extract sheet index from path like "sheets[0].qProperty..."
		const sheetMatch = path.match(/sheets\[(\d+)\]/);
		if (sheetMatch) {
			const sheetIndex = parseInt(sheetMatch[1]);
			const data = dataFiles[fileName];
			if (data?.sheets?.[sheetIndex]?.qProperty?.qMetaDef?.title) {
				return data.sheets[sheetIndex].qProperty.qMetaDef.title;
			}
		}
		return null;
	}

	function performSearch() {
		isSearching = true;
		const query = searchQuery.trim();
		const hasQuery = query.length > 0;
		
		// Check if any filters are actually selected
		const hasAppSelections = selectedApps.size > 0;
		const hasSheetSelections = selectedSheets.size > 0;
		const hasTypeSelections = selectedTypes.size > 0;
		
		// Check if all items are selected (treat as no filter)
		const allAppsSelected = hasAppSelections && selectedApps.size === apps.length;
		// For sheets, we need to check if all available sheets are selected
		// If no apps are selected, availableSheets will be empty, so we can't determine "all selected"
		// In that case, if sheets are selected, we should still filter
		const allSheetsSelected = hasSheetSelections && availableSheets.length > 0 && selectedSheets.size >= availableSheets.length;
		const allTypesSelected = hasTypeSelections && selectedTypes.size === typeOptions.length;
		
		// Only apply filters if not all items are selected
		const hasAppFilters = hasAppSelections && !allAppsSelected;
		// For sheets: if sheets are selected and (no apps selected OR not all available sheets selected), apply filter
		const hasSheetFilters = hasSheetSelections && (!hasAppSelections || !allSheetsSelected);
		const hasTypeFilters = hasTypeSelections && !allTypesSelected;
		
		
		const hasAnySelections = hasAppSelections || hasSheetSelections || hasTypeSelections;

		// If no search query and no filters selected, show no results
		if (!hasQuery && !hasAnySelections) {
			searchResults = [];
			unfilteredResults = [];
			isSearching = false;
			return;
		}

		// Use Fuse.js to search if we have a query, otherwise use all items
		let candidateResults: SearchableItem[] = [];
		if (hasQuery && fuseInstance) {
			const fuseResults = fuseInstance.search(query);
			candidateResults = fuseResults.map(result => result.item);
		} else {
			// No query, so include all items
			candidateResults = searchableIndex;
		}
		
		// Apply filters
		const allResults: typeof searchResults = [];
		unfilteredResults = [];

		let filteredByType = 0;
		let filteredBySheet = 0;
		let filteredByApp = 0;
		
		for (const item of candidateResults) {
			const isSheetObject = item.objectType === 'Sheet Measure' || item.objectType === 'Sheet Dimension';
			const sheetName = item.sheetName || item.sheet;

			// Check app filter
			if (hasAppFilters && !selectedApps.has(item.app)) {
				filteredByApp++;
				continue;
			}

			// Check sheet filter (only for sheet objects)
			// Master objects don't have sheets, so skip sheet filtering for them
			if (hasSheetFilters) {
				if (isSheetObject) {
					// For sheet objects, check if the sheet is selected
					if (!sheetName) {
						// If it's a sheet object but has no sheet name, skip it
						filteredBySheet++;
						continue;
					}
					if (!selectedSheets.has(sheetName)) {
						filteredBySheet++;
						continue;
					}
				}
				// If it's a master object, it passes the sheet filter (masters don't have sheets)
			}

			// Add to unfilteredResults if it passes app/sheet filters (used for availableTypes)
			unfilteredResults.push({
				path: item.path,
				object: item.object,
				objectType: item.objectType,
				context: item.context,
				file: item.file,
				app: item.app,
				sheet: sheetName,
				sheetName: sheetName
			});

			// Check type filter - always apply if types are selected and not all types are selected
			if (hasTypeFilters) {
				// If item has no objectType, skip it
				if (!item.objectType) {
					filteredByType++;
					continue;
				}
				// If the item's type is not in the selected types, skip it
				if (!selectedTypes.has(item.objectType)) {
					filteredByType++;
					continue;
				}
			}

			// Add to final results
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
				chartId: item.chartId || null
			});
		}

		searchResults = allResults;
		isSearching = false;
	}

	// Debounce search effect to prevent blocking
	let searchEffectTimeout;
	
	// Initialize with empty results - search will run when query or filters change
	$effect(() => {
		// Explicitly track all reactive dependencies to ensure effect runs
		const query = searchQuery;
		const appsSize = selectedApps.size;
		const sheetsSize = selectedSheets.size;
		const typesSize = selectedTypes.size;
		
		// Clear any pending search
		if (searchEffectTimeout) {
			clearTimeout(searchEffectTimeout);
		}
		
		// Only perform search if there's a query or filters are selected
		const hasQuery = searchQuery.trim().length > 0;
		const hasSelections = selectedApps.size > 0 || selectedSheets.size > 0 || selectedTypes.size > 0;
		
		if (hasQuery || hasSelections) {
			// Set loading state immediately when filters/query change
			isSearching = true;
			// Debounce the search to avoid blocking UI
			searchEffectTimeout = setTimeout(() => {
				performSearch();
			}, 200);
		} else {
			searchResults = [];
			unfilteredResults = [];
			isSearching = false;
		}
		
		// Cleanup function
		return () => {
			if (searchEffectTimeout) {
				clearTimeout(searchEffectTimeout);
			}
		};
	});

	// Debounce search for better performance
	let searchTimeout;
	function handleSearchInput() {
		// Set loading state immediately when user types
		isSearching = true;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			performSearch();
		}, 300);
	}

	function toggleApp(appName) {
		const newSet = createNewSet(selectedApps);
		const wasSelected = newSet.has(appName);
		
		if (wasSelected) {
			newSet.delete(appName);
			// Remove sheets from this app when app is deselected
			const sheetsToRemove = sheets
				.filter((sheet) => sheet.app === appName)
				.map((sheet) => sheet.name);
			const newSheetsSet = createNewSet(selectedSheets);
			sheetsToRemove.forEach((sheetName) => newSheetsSet.delete(sheetName));
			selectedSheets = newSheetsSet;
		} else {
			newSet.add(appName);
		}
		selectedApps = newSet;
		// Search will be triggered automatically by $effect watching selectedApps
	}

	function toggleSheet(sheetName) {
		const newSet = createNewSet(selectedSheets);
		if (newSet.has(sheetName)) {
			newSet.delete(sheetName);
		} else {
			newSet.add(sheetName);
		}
		selectedSheets = newSet;
		// Search will be triggered automatically by $effect watching selectedSheets
	}

	function selectAllApps() {
		selectedApps = new Set(apps.map((a) => a.name));
		// Search will be triggered automatically by $effect watching selectedApps
	}

	function deselectAllApps() {
		selectedApps = new Set();
		selectedSheets = new Set(); // Deselect all sheets when no apps are selected
		// Search will be triggered automatically by $effect watching selectedApps
	}

	function selectAllSheets() {
		selectedSheets = new Set(availableSheets);
		// Search will be triggered automatically by $effect watching selectedSheets
	}

	function deselectAllSheets() {
		selectedSheets = new Set();
		// Search will be triggered automatically by $effect watching selectedSheets
	}

	function toggleType(typeName) {
		const newSet = createNewSet(selectedTypes);
		if (newSet.has(typeName)) {
			newSet.delete(typeName);
		} else {
			newSet.add(typeName);
		}
		selectedTypes = newSet;
		// Search will be triggered automatically by $effect watching selectedTypes
	}

	function selectAllTypes() {
		selectedTypes = new Set<string>(availableTypes);
		// Search will be triggered automatically by $effect watching selectedTypes
	}

	function deselectAllTypes() {
		selectedTypes = new Set();
		// Search will be triggered automatically by $effect watching selectedTypes
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

		// Prepare data for Excel export
		const excelData = searchResults.map((result) => {
			const obj = result.object;
			const title = obj?.title || obj?.qAlias || (Array.isArray(obj?.qFieldLabels) && obj.qFieldLabels.length > 0 ? obj.qFieldLabels[0] : '') || 'N/A';
			const definition = obj?.qDef || 'N/A';
			const sheetName = result.sheet || result.sheetName || 'N/A';
			const sheetId = result.sheetId || result.context?.sheetId || null;
			const chartId = result.chartId || obj?.qInfo?.qId || null;

			return {
				Title: title,
				Definition: definition,
				App: result.app,
				Sheet: sheetName,
				Type: result.objectType || 'N/A',
				'Sheet ID': sheetId || 'N/A',
				'Chart ID': chartId || 'N/A'
			};
		});

		// Create a new workbook and worksheet
		const worksheet = XLSX.utils.json_to_sheet(excelData);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Search Results');

		// Generate filename with timestamp
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
		const filename = `search-results-${timestamp}.xlsx`;

		// Write and download the file
		XLSX.writeFile(workbook, filename);
	}

</script>

<div class="w-full flex-1 flex min-h-0 gap-4">
	<!-- Left Sidebar - Filters -->
	<aside class="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
		<div class="p-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
		</div>
		<div class="flex-1 overflow-y-auto p-4 space-y-6">
			<!-- App Filters -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<button
						type="button"
						onclick={() => (appsExpanded = !appsExpanded)}
						class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
					>
						<svg
							class="w-4 h-4 transition-transform {appsExpanded ? 'rotate-90' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
						<span>Apps ({selectedApps.size}/{apps.length})</span>
					</button>
					<div class="flex gap-1">
						<button
							type="button"
							onclick={selectAllApps}
							class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
						>
							All
						</button>
						<span class="text-xs text-gray-400">|</span>
						<button
							type="button"
							onclick={deselectAllApps}
							class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
						>
							None
						</button>
					</div>
				</div>
				{#if appsExpanded}
					<div class="space-y-2">
						{#each apps as app}
							<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
								<input
									type="checkbox"
									checked={selectedApps.has(app.name)}
									onchange={() => toggleApp(app.name)}
									class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
								/>
								<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{app.name}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Sheet Filters -->
			<div>
				<div class="flex items-center justify-between mb-3">
					<button
						type="button"
						onclick={() => (sheetsExpanded = !sheetsExpanded)}
						class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
					>
						<svg
							class="w-4 h-4 transition-transform {sheetsExpanded ? 'rotate-90' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5l7 7-7 7"
							/>
						</svg>
						<span>Sheets ({selectedSheets.size}/{availableSheets.length})</span>
					</button>
					<div class="flex gap-1">
						<button
							type="button"
							onclick={selectAllSheets}
							class="text-xs text-green-600 dark:text-green-400 hover:underline"
						>
							All
						</button>
						<span class="text-xs text-gray-400">|</span>
						<button
							type="button"
							onclick={deselectAllSheets}
							class="text-xs text-green-600 dark:text-green-400 hover:underline"
						>
							None
						</button>
					</div>
				</div>
				{#if sheetsExpanded}
					<div class="space-y-2">
						{#each availableSheets as sheetName}
							<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
								<input
									type="checkbox"
									checked={selectedSheets.has(sheetName)}
									onchange={() => toggleSheet(sheetName)}
									class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
								/>
								<span class="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate">{sheetName}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Type Filters -->
			<div>
				<div class="flex items-center justify-between mb-3">
						<button
							type="button"
							onclick={() => (typesExpanded = !typesExpanded)}
							class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
						>
							<svg
								class="w-4 h-4 transition-transform {typesExpanded ? 'rotate-90' : ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
							<span>Types ({selectedTypes.size}/{availableTypes.length})</span>
						</button>
						<div class="flex gap-1">
							<button
								type="button"
								onclick={selectAllTypes}
								class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
							>
								All
							</button>
							<span class="text-xs text-gray-400">|</span>
							<button
								type="button"
								onclick={deselectAllTypes}
								class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
							>
								None
							</button>
						</div>
					</div>
					{#if typesExpanded && availableTypes.length > 0}
						<div class="space-y-2">
							{#each availableTypes as typeName}
								<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
									<input
										type="checkbox"
										checked={selectedTypes.has(typeName)}
										onchange={() => toggleType(typeName)}
										class="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
									/>
									<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{typeName}</span>
								</label>
							{/each}
						</div>
					{/if}
				</div>
		</div>
	</aside>

	<!-- Main Content Area -->
	<div class="flex-1 flex flex-col min-h-0 min-w-0">
		<!-- Search Input -->
		<div class="flex-shrink-0 mb-6">
			<div class="relative">
				<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
					<svg
						class="h-5 w-5 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					oninput={handleSearchInput}
					placeholder="Search through data files..."
					class="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
				/>
				{#if isSearching}
					<div class="absolute inset-y-0 right-0 pr-3 flex items-center">
						<svg
							class="animate-spin h-5 w-5 text-gray-400"
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
					</div>
				{/if}
			</div>
		</div>

		<!-- Search Results -->
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
			<div class="flex flex-col flex-1 min-h-0 space-y-4">
				<div class="flex items-center justify-between flex-shrink-0">
					<div class="text-sm text-gray-600 dark:text-gray-400">
						Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
						{#if searchQuery.trim()}
							for "{searchQuery}"
						{/if}
					</div>
					{#if searchResults.length > 0}
						<button
							type="button"
							onclick={exportToExcel}
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

				{#if searchResults.length > 0}
					<div class="overflow-y-auto flex-1 min-h-0">
						<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
							<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
								<tr>
									<th class="w-[15%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
									<th class="w-[25%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Definition</th>
									<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">App</th>
									<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sheet</th>
									<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
									<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sheet URL</th>
									<th class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chart URL</th>
								</tr>
							</thead>
							<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
								{#each searchResults as result}
									{@const obj = result.object}
									{@const title = obj?.title || obj?.qAlias || (Array.isArray(obj?.qFieldLabels) && obj.qFieldLabels.length > 0 ? obj.qFieldLabels[0] : '') || 'N/A'}
									{@const definition = obj?.qDef || 'N/A'}
									{@const sheetName = result.sheet || result.sheetName || 'N/A'}
									{@const sheetId = result.sheetId || result.context?.sheetId || null}
									{@const chartId = result.chartId || obj?.qInfo?.qId || null}
									<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
										<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
											<div class="truncate" title={title}>{title}</div>
										</td>
									<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
										<div class="flex items-center gap-2 group">
											<div class="flex-1 truncate" title={definition}>{definition}</div>
											{#if definition !== 'N/A'}
												<button
													type="button"
													onclick={() => copyToClipboard(definition, `${result.path}-${result.app}`)}
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
											<div class="truncate" title={sheetName}>{sheetName}</div>
										</td>
										<td class="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
											<div class="truncate" title={result.objectType}>{result.objectType}</div>
										</td>
										<td class="px-4 py-4 text-sm">
											{#if sheetId}
												<div class="truncate" title={sheetId}>
													<span class="text-blue-600 dark:text-blue-400 font-mono text-xs">{sheetId}</span>
												</div>
											{:else}
												<span class="text-gray-400">N/A</span>
											{/if}
										</td>
										<td class="px-4 py-4 text-sm">
											{#if chartId}
												<div class="truncate" title={chartId}>
													<span class="text-blue-600 dark:text-blue-400 font-mono text-xs">{chartId}</span>
												</div>
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
		{/if}
	</div>
</div>

