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
		onToggleSpace: (spaceId: string) => void;
		onToggleApp: (appName: string) => void;
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
					{#each apps as app, index (app.name || `app-${index}`)}
						<label class="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1.5 -mx-2">
							<input
								type="checkbox"
								checked={selectedApps.has(app.name)}
								onchange={() => onToggleApp(app.name)}
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

