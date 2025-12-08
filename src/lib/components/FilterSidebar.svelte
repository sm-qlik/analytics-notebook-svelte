<script lang="ts">
	interface Props {
		spaces: Array<{ name: string; id: string }>;
		apps: Array<{ name: string; id: string }>;
		availableSheets: Array<{ name: string; id: string; appId: string }>;
		selectedSpaces: Set<string>;
		selectedApps: Set<string>;
		selectedSheets: Set<string>;
		selectedSheetStates: Set<string>;
		loadedAppIds: Set<string>;
		loadingAppIds: Set<string>;
		tenantHostname: string;
		isCollapsed: boolean;
		onToggleCollapse: () => void;
		onToggleSpace: (spaceId: string) => void;
		onToggleApp: (appId: string) => void;
		onToggleSheet: (sheetName: string) => void;
		onToggleSheetState: (state: string) => void;
		onSelectAllSpaces: () => void;
		onDeselectAllSpaces: () => void;
		onSelectAllApps: () => void;
		onDeselectAllApps: () => void;
		onSelectAllSheets: () => void;
		onDeselectAllSheets: () => void;
		onSelectAllSheetStates: () => void;
		onDeselectAllSheetStates: () => void;
	}

	let {
		spaces,
		apps,
		availableSheets,
		selectedSpaces,
		selectedApps,
		selectedSheets,
		selectedSheetStates,
		loadedAppIds,
		loadingAppIds,
		tenantHostname,
		isCollapsed,
		onToggleCollapse,
		onToggleSpace,
		onToggleApp,
		onToggleSheet,
		onToggleSheetState,
		onSelectAllSpaces,
		onDeselectAllSpaces,
		onSelectAllApps,
		onDeselectAllApps,
		onSelectAllSheets,
		onDeselectAllSheets,
		onSelectAllSheetStates,
		onDeselectAllSheetStates
	}: Props = $props();

	let spacesExpanded = $state(true);
	let appsExpanded = $state(true);
	let sheetsExpanded = $state(true);
	let sheetStatesExpanded = $state(true);

	let searchQuery = $state('');
	let sheetSearchQuery = $state('');

	// Resizable sidebar width
	const MIN_WIDTH = 200;
	const MAX_WIDTH = 600;
	const DEFAULT_WIDTH = 256; // w-64 = 256px
	
	let sidebarWidth = $state(DEFAULT_WIDTH);
	let isResizing = $state(false);
	let resizeStartX = $state(0);
	let resizeStartWidth = $state(0);

	// Load saved width from localStorage on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const savedWidth = localStorage.getItem('filterSidebarWidth');
			if (savedWidth) {
				const width = parseInt(savedWidth, 10);
				if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
					sidebarWidth = width;
				}
			}
		}
	});

	function handleResizeStart(e: MouseEvent) {
		if (isCollapsed) return;
		isResizing = true;
		resizeStartX = e.clientX;
		resizeStartWidth = sidebarWidth;
		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeEnd);
		e.preventDefault();
	}

	function handleResizeMove(e: MouseEvent) {
		if (!isResizing) return;
		const deltaX = e.clientX - resizeStartX;
		const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth + deltaX));
		sidebarWidth = newWidth;
	}

	function handleResizeEnd() {
		if (isResizing) {
			isResizing = false;
			// Save to localStorage
			if (typeof window !== 'undefined') {
				localStorage.setItem('filterSidebarWidth', sidebarWidth.toString());
			}
			document.removeEventListener('mousemove', handleResizeMove);
			document.removeEventListener('mouseup', handleResizeEnd);
		}
	}

	// Cleanup event listeners on unmount
	$effect(() => {
		return () => {
			if (isResizing) {
				document.removeEventListener('mousemove', handleResizeMove);
				document.removeEventListener('mouseup', handleResizeEnd);
			}
		};
	});

	// Filtered spaces and apps based on search query
	let filteredSpaces = $derived(
		searchQuery.trim()
			? spaces.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: spaces
	);

	let filteredApps = $derived(
		searchQuery.trim()
			? apps.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: apps
	);

	// Filtered sheets based on sheet search query (searches both name and ID)
	let filteredSheets = $derived(
		sheetSearchQuery.trim()
			? availableSheets.filter((s) => 
				s.name.toLowerCase().includes(sheetSearchQuery.toLowerCase()) ||
				s.id.toLowerCase().includes(sheetSearchQuery.toLowerCase())
			)
			: availableSheets
	);
</script>

<div class="relative flex-shrink-0 {isCollapsed ? 'w-8' : ''}" style={isCollapsed ? '' : `width: ${sidebarWidth}px`}>
	<!-- Toggle Button at the top - always visible, flush against border -->
	<button
		type="button"
		onclick={onToggleCollapse}
		class="absolute top-0 {isCollapsed ? 'left-0' : 'right-0'} z-20 w-8 h-8 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 {isCollapsed ? 'rounded-r-lg border-l-0 border-r-2' : 'rounded-l-lg border-r-2'} shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer"
		title={isCollapsed ? "Show filters" : "Hide filters"}
	>
		<svg 
			class="w-4 h-4 transition-transform {isCollapsed ? 'rotate-180' : ''}" 
			fill="none" 
			stroke="currentColor" 
			stroke-width="2.5"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
	</button>
	
	<aside class="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 {isCollapsed ? 'w-0 overflow-hidden' : 'overflow-x-hidden'}" style={isCollapsed ? '' : `width: ${sidebarWidth}px`}>
	{#if !isCollapsed}
		<div class="p-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
		</div>
	<!-- Search Input for Apps & Spaces -->
	<div class="px-4 pt-4">
		<div class="relative">
			<svg
				class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search apps & spaces..."
				class="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
			/>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					aria-label="Clear search"
					class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>
	<div class="flex-1 overflow-y-auto p-4 space-y-6">
		<!-- Space Filters -->
		{#if spaces && spaces.length > 0}
			<div>
				<div class="flex items-center justify-between mb-3">
					<button
						type="button"
						onclick={() => (spacesExpanded = !spacesExpanded)}
						class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
					>
						<svg
							class="w-4 h-4 transition-transform {spacesExpanded ? 'rotate-90' : ''}"
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
						<span>Spaces ({selectedSpaces.size}/{spaces.length})</span>
					</button>
					<div class="flex gap-1">
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								onSelectAllSpaces();
							}}
							class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
						>
							All
						</button>
						<span class="text-xs text-gray-400">|</span>
						<button
							type="button"
							onclick={(e) => {
								e.stopPropagation();
								onDeselectAllSpaces();
							}}
							class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
						>
							None
						</button>
					</div>
				</div>
				{#if spacesExpanded}
					<div class="space-y-2 max-h-[240px] overflow-y-auto overflow-x-hidden">
						{#each filteredSpaces as space (space.id)}
							{@const isChecked = selectedSpaces.has(space.id)}
							{@const spaceId = space.id}
							<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
								<input
									type="checkbox"
									checked={isChecked}
									onclick={(e) => {
										e.stopPropagation();
										onToggleSpace(spaceId);
									}}
									class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
								/>
								<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{space.name}</span>
							</label>
						{/each}
						{#if filteredSpaces.length === 0 && searchQuery}
							<p class="text-xs text-gray-500 dark:text-gray-400 italic px-2">No matching spaces</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

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
						onclick={onSelectAllApps}
						class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						type="button"
						onclick={onDeselectAllApps}
						class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
					>
						None
					</button>
				</div>
			</div>
			{#if appsExpanded}
				<div class="space-y-2 max-h-[240px] overflow-y-auto overflow-x-hidden">
					{#each filteredApps as app (`${tenantHostname}-${app.id}`)}
						{@const isLoaded = loadedAppIds.has(app.id)}
						{@const isLoading = loadingAppIds.has(app.id)}
						<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
							<input
								type="checkbox"
								checked={selectedApps.has(app.id)}
								onchange={() => onToggleApp(app.id)}
								class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
							/>
							<span class="ml-2 flex-1 flex items-center gap-1.5 min-w-0">
								<span class="text-sm text-gray-700 dark:text-gray-300 truncate" title="{app.name} ({app.id})">
									{app.name} <span class="text-gray-400 dark:text-gray-500">({app.id.slice(0, 8)}...)</span>
								</span>
								{#if isLoading}
									<svg class="flex-shrink-0 w-3.5 h-3.5 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else if isLoaded}
									<svg class="flex-shrink-0 w-3.5 h-3.5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
										<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
									</svg>
								{:else}
									<span class="flex-shrink-0 w-3.5 h-3.5 flex items-center justify-center">
										<span class="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
									</span>
								{/if}
							</span>
						</label>
					{/each}
					{#if filteredApps.length === 0 && searchQuery}
						<p class="text-xs text-gray-500 dark:text-gray-400 italic px-2">No matching apps</p>
					{/if}
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
						onclick={onSelectAllSheets}
						class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						type="button"
						onclick={onDeselectAllSheets}
						class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
					>
						None
					</button>
				</div>
			</div>
			{#if sheetsExpanded}
				<!-- Sheet Search Input -->
				<div class="relative mb-2">
					<svg
						class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
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
					<input
						type="text"
						bind:value={sheetSearchQuery}
						placeholder="Search sheets..."
						class="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-green-500 focus:border-transparent"
					/>
					{#if sheetSearchQuery}
						<button
							type="button"
							onclick={() => (sheetSearchQuery = '')}
							aria-label="Clear sheet search"
							class="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						>
							<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>
				<div class="space-y-2 max-h-[240px] overflow-y-auto overflow-x-hidden">
					{#each filteredSheets as sheet (sheet.id)}
						<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
							<input
								type="checkbox"
								checked={selectedSheets.has(sheet.id)}
								onchange={() => onToggleSheet(sheet.id)}
								class="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate" title="{sheet.name} ({sheet.id})">
								{sheet.name} <span class="text-gray-400 dark:text-gray-500">({sheet.id.slice(0, 8)}...)</span>
							</span>
						</label>
					{/each}
					{#if filteredSheets.length === 0 && sheetSearchQuery}
						<p class="text-xs text-gray-500 dark:text-gray-400 italic px-2">No matching sheets</p>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Sheet State Filters -->
		<div>
			<div class="flex items-center justify-between mb-3">
				<button
					type="button"
					onclick={() => (sheetStatesExpanded = !sheetStatesExpanded)}
					class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
				>
					<svg
						class="w-4 h-4 transition-transform {sheetStatesExpanded ? 'rotate-90' : ''}"
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
					<span>Sheet States ({selectedSheetStates.size}/3)</span>
				</button>
				<div class="flex gap-1">
					<button
						type="button"
						onclick={onSelectAllSheetStates}
						class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						type="button"
						onclick={onDeselectAllSheetStates}
						class="text-xs text-gray-600 dark:text-gray-400 hover:underline"
					>
						None
					</button>
				</div>
			</div>
			{#if sheetStatesExpanded}
				<div class="space-y-2">
					{#each ['Public', 'Community', 'Private'] as state}
						{@const isChecked = selectedSheetStates.has(state)}
						<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
							<input
								type="checkbox"
								checked={isChecked}
								onchange={() => onToggleSheetState(state)}
								class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
							/>
							<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{state}</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>

		</div>
	{/if}
	</aside>
	
	<!-- Resize Handle -->
	{#if !isCollapsed}
		<button
			type="button"
			aria-label="Resize filter panel"
			onmousedown={handleResizeStart}
			class="absolute top-8 right-0 w-1 h-[calc(100%-2rem)] cursor-col-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors z-10 {isResizing ? 'bg-blue-500 dark:bg-blue-400' : ''} border-0 p-0 bg-transparent"
			title="Drag to resize"
		></button>
	{/if}
</div>

