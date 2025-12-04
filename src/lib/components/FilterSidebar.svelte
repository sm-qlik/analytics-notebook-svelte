<script lang="ts">
	interface Props {
		spaces: Array<{ name: string; id: string }>;
		apps: Array<{ name: string; id: string }>;
		availableSheets: string[];
		availableTypes: string[];
		selectedSpaces: Set<string>;
		selectedApps: Set<string>;
		selectedSheets: Set<string>;
		selectedTypes: Set<string>;
		loadedAppIds: Set<string>;
		loadingAppIds: Set<string>;
		tenantHostname: string;
		onToggleSpace: (spaceId: string) => void;
		onToggleApp: (appId: string) => void;
		onToggleSheet: (sheetName: string) => void;
		onToggleType: (typeName: string) => void;
		onSelectAllSpaces: () => void;
		onDeselectAllSpaces: () => void;
		onSelectAllApps: () => void;
		onDeselectAllApps: () => void;
		onSelectAllSheets: () => void;
		onDeselectAllSheets: () => void;
		onSelectAllTypes: () => void;
		onDeselectAllTypes: () => void;
	}

	let {
		spaces,
		apps,
		availableSheets,
		availableTypes,
		selectedSpaces,
		selectedApps,
		selectedSheets,
		selectedTypes,
		loadedAppIds,
		loadingAppIds,
		tenantHostname,
		onToggleSpace,
		onToggleApp,
		onToggleSheet,
		onToggleType,
		onSelectAllSpaces,
		onDeselectAllSpaces,
		onSelectAllApps,
		onDeselectAllApps,
		onSelectAllSheets,
		onDeselectAllSheets,
		onSelectAllTypes,
		onDeselectAllTypes
	}: Props = $props();

	let spacesExpanded = $state(true);
	let appsExpanded = $state(true);
	let sheetsExpanded = $state(true);
	let typesExpanded = $state(true);
</script>

<aside class="w-64 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
	<div class="p-4 border-b border-gray-200 dark:border-gray-700">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
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
							class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
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
							class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
						>
							None
						</button>
					</div>
				</div>
				{#if spacesExpanded}
					<div class="space-y-2">
						{#each spaces as space (space.id)}
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
						class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						type="button"
						onclick={onDeselectAllApps}
						class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
					>
						None
					</button>
				</div>
			</div>
			{#if appsExpanded}
				<div class="space-y-2">
					{#each apps as app (`${tenantHostname}-${app.id}`)}
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
						class="text-xs text-green-600 dark:text-green-400 hover:underline"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						type="button"
						onclick={onDeselectAllSheets}
						class="text-xs text-green-600 dark:text-green-400 hover:underline"
					>
						None
					</button>
				</div>
			</div>
			{#if sheetsExpanded}
				<div class="space-y-2">
					{#each availableSheets as sheetName, index (sheetName || `sheet-${index}`)}
						<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
							<input
								type="checkbox"
								checked={selectedSheets.has(sheetName)}
								onchange={() => onToggleSheet(sheetName)}
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
						onclick={onSelectAllTypes}
						class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
					>
						All
					</button>
					<span class="text-xs text-gray-400">|</span>
					<button
						type="button"
						onclick={onDeselectAllTypes}
						class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
					>
						None
					</button>
				</div>
			</div>
			{#if typesExpanded && availableTypes.length > 0}
				<div class="space-y-2">
					{#each availableTypes as typeName, index (typeName || `type-${index}`)}
						<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
							<input
								type="checkbox"
								checked={selectedTypes.has(typeName)}
								onchange={() => onToggleType(typeName)}
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

