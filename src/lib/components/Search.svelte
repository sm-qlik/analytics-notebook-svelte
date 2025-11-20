<script lang="ts">
	// Import all JSON data files
	import appAnalyzer from '$lib/data/AppAnalyzer.json';
	import automationAnalyzer from '$lib/data/AutomationAnalyzer.json';
	import managerPeopleAnalytics from '$lib/data/ManagerPeopleAnalytics.json';
	import reloadAnalyzer from '$lib/data/ReloadAnalyzer.json';
	import QDimMeasureResult from './QDimMeasureResult.svelte';

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
	

	// Deep search function that searches through nested objects
	function deepSearch(obj, query, path = '', context = {}) {
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
	}

	// Helper function to search an object for matches (optimized with early exit)
	function searchObjectForMatch(obj, queryLower) {
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
	}

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

	async function performSearch() {
		isSearching = true;
		const allResults = [];
		unfilteredResults = []; // Reset unfiltered results
		const query = searchQuery.trim();
		const hasQuery = query.length > 0;
		
		// Check if all items are selected (treat as no filter)
		const allAppsSelected = selectedApps.size === apps.length && apps.length > 0;
		const allSheetsSelected = selectedSheets.size === availableSheets.length && availableSheets.length > 0;
		const allTypesSelected = selectedTypes.size === typeOptions.length;
		
		// Check if any filters are actually selected
		const hasAppSelections = selectedApps.size > 0;
		const hasSheetSelections = selectedSheets.size > 0;
		const hasTypeSelections = selectedTypes.size > 0;
		const hasAnySelections = hasAppSelections || hasSheetSelections || hasTypeSelections;
		
		// Only apply filters if not all items are selected
		const hasAppFilters = hasAppSelections && !allAppsSelected;
		const hasSheetFilters = hasSheetSelections && !allSheetsSelected;
		const hasTypeFilters = hasTypeSelections && !allTypesSelected;

		// If no search query and no filters selected, show no results
		if (!hasQuery && !hasAnySelections) {
			searchResults = [];
			unfilteredResults = [];
			isSearching = false;
			return;
		}

		// Search through each file (process async to avoid blocking)
		const fileEntries = Object.entries(dataFiles);
		for (let i = 0; i < fileEntries.length; i++) {
			const [fileName, data] = fileEntries[i];
			const appName = getAppName(fileName);

			// Filter by app - only if apps are selected
			if (hasAppSelections && !selectedApps.has(appName)) {
				continue;
			}

			const fileResults = deepSearch(data, query, '', {
				appName,
				fileName
			});

			for (const result of fileResults) {
				// Try to get sheet name from context first, then from path
				let sheetName = result.context?.sheetName;
				if (!sheetName) {
					sheetName = getSheetNameFromPath(result.path, fileName);
				}
				// Store sheetName in result for display (use null if undefined to distinguish from "No Sheet")
				result.sheetName = sheetName || null;
				
				const isMasterObject = result.context?.inMasterDimensions || result.context?.inMasterMeasures;
				const isSheetObject = result.context?.objectType === 'Sheet Measure' || result.context?.objectType === 'Sheet Dimension';

				// Create the result object
				const resultObj = {
					...result,
					file: fileName,
					app: appName,
					sheet: sheetName
				};

				// Check if it passes app/sheet filters (before type filtering)
				// This is used to populate unfilteredResults for availableTypes calculation
				const passesAppFilter = !hasAppSelections || selectedApps.has(appName);
				const passesSheetFilter = !hasSheetSelections || !isSheetObject || (sheetName && selectedSheets.has(sheetName));
				
				// Add to unfilteredResults if it passes app/sheet filters (used for availableTypes)
				if (passesAppFilter && passesSheetFilter) {
					unfilteredResults.push(resultObj);
				}

				// Filter by type - only if types are selected
				if (hasTypeSelections && result.objectType) {
					if (!selectedTypes.has(result.objectType)) {
						continue;
					}
				}

				// Filter by sheet - only if sheets are selected
				// Master objects don't have sheets, so skip sheet filtering for them
				// Sheet objects must have a sheet name and it must be in the selected sheets
				if (hasSheetSelections) {
					// Only filter sheet objects (not master objects)
					if (isSheetObject) {
						// If it's a sheet object but has no sheet name, exclude it
						if (!sheetName) {
							continue;
						}
						// If the sheet name is not in selected sheets, exclude it
						if (!selectedSheets.has(sheetName)) {
							continue;
						}
					}
				}

				allResults.push(resultObj);
			}
			
			// Yield to browser every file to prevent blocking
			await new Promise(resolve => setTimeout(resolve, 0));
			
			// Update results incrementally for better perceived performance (every file)
			searchResults = [...allResults];
		}

		searchResults = allResults;
		isSearching = false;
	}

	// Debounce search effect to prevent blocking
	let searchEffectTimeout;
	
	// Initialize with empty results - search will run when query or filters change
	$effect(() => {
		// Clear any pending search
		if (searchEffectTimeout) {
			clearTimeout(searchEffectTimeout);
		}
		
		// Only perform search if there's a query or filters are selected
		const hasQuery = searchQuery.trim().length > 0;
		const hasSelections = selectedApps.size > 0 || selectedSheets.size > 0 || selectedTypes.size > 0;
		
		if (hasQuery || hasSelections) {
			// Debounce the search to avoid blocking UI
			searchEffectTimeout = setTimeout(() => {
				performSearch().catch(console.error);
			}, 200);
		} else {
			searchResults = [];
			unfilteredResults = [];
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
		performSearch();
	}

	function toggleSheet(sheetName) {
		const newSet = createNewSet(selectedSheets);
		if (newSet.has(sheetName)) {
			newSet.delete(sheetName);
		} else {
			newSet.add(sheetName);
		}
		selectedSheets = newSet;
		performSearch();
	}

	function selectAllApps() {
		selectedApps = new Set(apps.map((a) => a.name));
		performSearch();
	}

	function deselectAllApps() {
		selectedApps = new Set();
		performSearch();
	}

	function selectAllSheets() {
		selectedSheets = new Set(availableSheets);
		performSearch();
	}

	function deselectAllSheets() {
		selectedSheets = new Set();
		performSearch();
	}

	function toggleType(typeName) {
		const newSet = createNewSet(selectedTypes);
		if (newSet.has(typeName)) {
			newSet.delete(typeName);
		} else {
			newSet.add(typeName);
		}
		selectedTypes = newSet;
		performSearch();
	}

	function selectAllTypes() {
		selectedTypes = new Set<string>(availableTypes);
		performSearch();
	}

	function deselectAllTypes() {
		selectedTypes = new Set();
		performSearch();
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
		{#if !isSearching}
			<div class="flex flex-col flex-1 min-h-0 space-y-4">
				<div class="text-sm text-gray-600 dark:text-gray-400 flex-shrink-0">
					Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
					{#if searchQuery.trim()}
						for "{searchQuery}"
					{/if}
				</div>

				{#if searchResults.length > 0}
					<div class="space-y-3 overflow-y-auto flex-1 min-h-0">
						{#each searchResults as result}
							<QDimMeasureResult {result} searchQuery={searchQuery.trim()} />
						{/each}
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

