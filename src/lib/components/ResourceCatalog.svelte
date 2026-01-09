<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { resourceCache } from '$lib/stores/resource-cache';
	import { loadQlikAPI, configureQlikAuthOnce } from '$lib/utils/qlik-auth';
	import ResourceTile from './ResourceTile.svelte';
	import type { ResourceType } from '$lib/types';
	import { RESOURCE_TYPE_INFO, getResourceTypeInfo } from '$lib/types';

	interface ResourceItem {
		resourceId: string;
		name: string;
		description?: string;
		spaceId?: string;
		updatedAt: string;
		resourceType: string;
		thumbnailId?: string;
		[key: string]: any;
	}

	interface Space {
		id: string;
		name: string;
	}

	interface Props {
		selectable?: boolean;
		selectedIds?: string[];
		onSelectionChange?: (ids: string[]) => void;
		filterResourceTypes?: ResourceType[];
		filterSpaceIds?: string[]; // Only show resources from these spaces (empty = show all)
		hideFilters?: boolean;
		compactMode?: boolean;
		directoryMode?: boolean; // New prop for directory-style browsing
	}

	let {
		selectable = false,
		selectedIds = [],
		onSelectionChange,
		filterResourceTypes,
		filterSpaceIds,
		hideFilters = false,
		compactMode = false,
		directoryMode = false
	}: Props = $props();

	let resources = $state<ResourceItem[]>([]);
	let spaces = $state<Space[]>([]);
	let isLoading = $state(false);
	let hasStartedLoading = $state(false);
	let loadError = $state<string | null>(null);
	let searchQuery = $state('');
	let selectedSpaceId = $state<string | null>(null);
	let selectedResourceType = $state<string | null>(null);
	let sortBy = $state<'name' | 'updatedAt'>('updatedAt');
	let currentTenantUrl = $state<string | null>(null);
	let usingCachedData = $state(false);
	let cacheAge = $state<string | null>(null);
	
	// Directory mode state - track which spaces are expanded
	let expandedSpaces = $state<Set<string>>(new Set());

	// Get available resource types
	const availableResourceTypes = $derived(() => {
		if (filterResourceTypes) {
			return filterResourceTypes.map(type => ({
				value: type,
				label: RESOURCE_TYPE_INFO[type]?.label || type
			}));
		}
		
		// Get unique types from loaded resources
		const types = new Set(resources.map(r => r.resourceType));
		return Array.from(types).map(type => ({
			value: type,
			label: RESOURCE_TYPE_INFO[type as ResourceType]?.label || type
		}));
	});

	// Check if a space ID is allowed by the filter
	const isSpaceAllowed = (spaceId: string | undefined): boolean => {
		// If no filter specified, all spaces are allowed
		if (!filterSpaceIds || filterSpaceIds.length === 0) return true;
		// Personal space (undefined spaceId) is only allowed if 'personal' is in the filter
		if (!spaceId) return filterSpaceIds.includes('personal');
		return filterSpaceIds.includes(spaceId);
	};

	// Filter resources (used in both modes)
	const filteredResources = $derived.by(() => {
		let filtered = resources;

		// First filter by allowed space IDs
		if (filterSpaceIds && filterSpaceIds.length > 0) {
			filtered = filtered.filter(r => isSpaceAllowed(r.spaceId));
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(r => 
				r.name.toLowerCase().includes(query) ||
				r.description?.toLowerCase().includes(query)
			);
		}

		// Filter by space (only in non-directory mode)
		if (!directoryMode && selectedSpaceId) {
			if (selectedSpaceId === 'personal') {
				filtered = filtered.filter(r => !r.spaceId);
			} else {
				filtered = filtered.filter(r => r.spaceId === selectedSpaceId);
			}
		}

		// Filter by resource type
		if (selectedResourceType) {
			const typeFilter = selectedResourceType;
			filtered = filtered.filter(r => r.resourceType === typeFilter || r.resourceType.startsWith(typeFilter));
		}

		// Sort
		return [...filtered].sort((a, b) => {
			if (sortBy === 'name') {
				return a.name.localeCompare(b.name);
			} else {
				return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
			}
		});
	});

	// Get spaces that should be shown (filtered by filterSpaceIds)
	const allowedSpaces = $derived.by(() => {
		if (!filterSpaceIds || filterSpaceIds.length === 0) return spaces;
		return spaces.filter(s => filterSpaceIds.includes(s.id));
	});

	// Group resources by space for directory mode
	const resourcesBySpace = $derived.by(() => {
		const grouped = new Map<string, ResourceItem[]>();
		
		// Initialize personal space (only if allowed)
		if (isSpaceAllowed(undefined)) {
			grouped.set('personal', []);
		}
		
		// Initialize allowed spaces
		for (const space of allowedSpaces) {
			grouped.set(space.id, []);
		}
		
		// Group filtered resources
		for (const resource of filteredResources) {
			const spaceKey = resource.spaceId || 'personal';
			if (grouped.has(spaceKey)) {
				const existing = grouped.get(spaceKey) || [];
				existing.push(resource);
				grouped.set(spaceKey, existing);
			}
		}
		
		return grouped;
	});

	// Get spaces that have resources (for display)
	const spacesWithResources = $derived.by(() => {
		const result: Array<{ id: string; name: string; count: number }> = [];
		
		// Personal space (only if allowed)
		if (isSpaceAllowed(undefined)) {
			const personalResources = resourcesBySpace.get('personal') || [];
			if (personalResources.length > 0 || !searchQuery.trim()) {
				result.push({ id: 'personal', name: 'Personal', count: personalResources.length });
			}
		}
		
		// Other spaces (only allowed ones)
		for (const space of allowedSpaces) {
			const spaceResources = resourcesBySpace.get(space.id) || [];
			if (spaceResources.length > 0 || !searchQuery.trim()) {
				result.push({ id: space.id, name: space.name, count: spaceResources.length });
			}
		}
		
		return result.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Toggle space expansion
	function toggleSpace(spaceId: string) {
		const newExpanded = new Set(expandedSpaces);
		if (newExpanded.has(spaceId)) {
			newExpanded.delete(spaceId);
		} else {
			newExpanded.add(spaceId);
		}
		expandedSpaces = newExpanded;
	}

	// Expand all spaces
	function expandAll() {
		const newExpanded = new Set<string>();
		newExpanded.add('personal');
		for (const space of spaces) {
			newExpanded.add(space.id);
		}
		expandedSpaces = newExpanded;
	}

	// Collapse all spaces
	function collapseAll() {
		expandedSpaces = new Set();
	}

	// Select all resources in a space
	function selectAllInSpace(spaceId: string) {
		if (!onSelectionChange) return;
		const spaceResources = resourcesBySpace.get(spaceId) || [];
		const spaceResourceIds = spaceResources.map(r => r.resourceId);
		const newSelection = new Set(selectedIds);
		for (const id of spaceResourceIds) {
			newSelection.add(id);
		}
		onSelectionChange(Array.from(newSelection));
	}

	// Deselect all resources in a space
	function deselectAllInSpace(spaceId: string) {
		if (!onSelectionChange) return;
		const spaceResources = resourcesBySpace.get(spaceId) || [];
		const spaceResourceIds = new Set(spaceResources.map(r => r.resourceId));
		onSelectionChange(selectedIds.filter(id => !spaceResourceIds.has(id)));
	}

	// Check if all resources in a space are selected
	function isSpaceFullySelected(spaceId: string): boolean {
		const spaceResources = resourcesBySpace.get(spaceId) || [];
		if (spaceResources.length === 0) return false;
		return spaceResources.every(r => selectedIds.includes(r.resourceId));
	}

	// Check if some resources in a space are selected
	function isSpacePartiallySelected(spaceId: string): boolean {
		const spaceResources = resourcesBySpace.get(spaceId) || [];
		const selectedCount = spaceResources.filter(r => selectedIds.includes(r.resourceId)).length;
		return selectedCount > 0 && selectedCount < spaceResources.length;
	}

	// Get count of selected resources in a space
	function getSelectedCountInSpace(spaceId: string): number {
		const spaceResources = resourcesBySpace.get(spaceId) || [];
		return spaceResources.filter(r => selectedIds.includes(r.resourceId)).length;
	}

	// Get space name by ID
	function getSpaceName(spaceId?: string): string | undefined {
		if (!spaceId) return 'Personal';
		const space = spaces.find(s => s.id === spaceId);
		return space?.name;
	}

	// Fetch all resources with pagination
	async function fetchAllResources(items: any): Promise<ResourceItem[]> {
		const allResources: ResourceItem[] = [];
		let nextUrl: string | null = null;
		let pageCount = 0;
		const maxPages = 100;

		// Build request params - only include resourceType if filtering
		const baseParams: Record<string, any> = { limit: 100 };
		if (filterResourceTypes && filterResourceTypes.length > 0) {
			baseParams.resourceType = filterResourceTypes.join(',');
		}
		// If no filter, omit resourceType to get all items

		// First request
		let response = await items.getItems(baseParams, { noCache: false });
		if (response.status !== 200) {
			throw new Error(`Failed to get items: ${response.status}`);
		}

		allResources.push(...(response.data?.data || []));
		nextUrl = response.data?.links?.next?.href || null;
		pageCount++;

		// Follow pagination links
		while (nextUrl && pageCount < maxPages) {
			try {
				const url = new URL(nextUrl, 'https://placeholder.com');
				const searchParams = new URLSearchParams(url.search);

				response = await items.getItems({
					...baseParams,
					...Object.fromEntries(searchParams.entries())
				});

				if (response.status !== 200) break;

				const pageResources = response.data?.data || [];
				if (pageResources.length === 0) break;

				allResources.push(...pageResources);
				nextUrl = response.data?.links?.next?.href || null;
				pageCount++;
			} catch (err) {
				console.warn('Error during pagination:', err);
				break;
			}
		}

		return allResources;
	}

	// Fetch all spaces with pagination
	async function fetchAllSpaces(spacesApi: any): Promise<Space[]> {
		const allSpaces: Space[] = [];
		let nextUrl: string | null = null;
		let pageCount = 0;
		const maxPages = 100;

		let response = await spacesApi.getSpaces({ limit: 100 });
		if (response.status !== 200) {
			throw new Error(`Failed to get spaces: ${response.status}`);
		}

		allSpaces.push(...(response.data?.data || []));
		nextUrl = response.data?.links?.next?.href || null;
		pageCount++;

		while (nextUrl && pageCount < maxPages) {
			try {
				const url = new URL(nextUrl, 'https://placeholder.com');
				const searchParams = new URLSearchParams(url.search);

				response = await spacesApi.getSpaces({
					limit: 100,
					...Object.fromEntries(searchParams.entries())
				});

				if (response.status !== 200) break;

				const pageSpaces = response.data?.data || [];
				if (pageSpaces.length === 0) break;

				allSpaces.push(...pageSpaces);
				nextUrl = response.data?.links?.next?.href || null;
				pageCount++;
			} catch (err) {
				console.warn('Error during spaces pagination:', err);
				break;
			}
		}

		return allSpaces.map((space: any) => ({
			id: space.resourceId || space.id || space.spaceId,
			name: space.name || space.resourceId || space.id
		}));
	}

	async function loadResourcesAndSpaces() {
		if (hasStartedLoading) return;
		hasStartedLoading = true;
		isLoading = true;
		loadError = null;
		usingCachedData = false;
		cacheAge = null;

		try {
			let tenantUrl: string | null = null;
			const unsubscribe = authStore.subscribe(state => {
				tenantUrl = state.tenantUrl;
			});
			unsubscribe();

			if (!tenantUrl) {
				throw new Error('Not authenticated');
			}

			currentTenantUrl = tenantUrl;

			// Check cache first
			const cachedResources = resourceCache.getResources(tenantUrl);
			const cachedSpaces = resourceCache.getSpaces(tenantUrl);
			
			if (cachedResources && cachedSpaces) {
				console.log(`Using cached data: ${cachedResources.length} resources, ${cachedSpaces.length} spaces`);
				resources = cachedResources;
				spaces = cachedSpaces;
				usingCachedData = true;
				cacheAge = resourceCache.getCacheAge();
				isLoading = false;
				return;
			}

			// Fetch from API
			await configureQlikAuthOnce(tenantUrl);
			const qlikApi = await loadQlikAPI();
			const { items, spaces: spacesApi } = qlikApi;

			const [fetchedResources, fetchedSpaces] = await Promise.all([
				fetchAllResources(items),
				spacesApi ? fetchAllSpaces(spacesApi).catch(() => []) : Promise.resolve([])
			]);

			resources = fetchedResources;
			spaces = fetchedSpaces;
			usingCachedData = false;
			cacheAge = null;

			// Store in cache
			resourceCache.setData(tenantUrl, fetchedResources, fetchedSpaces);

			console.log(`Loaded ${resources.length} resources and ${spaces.length} spaces (now cached)`);
		} catch (err: any) {
			console.error('Failed to load resources:', err);
			loadError = err.message || 'Failed to load resources';
		} finally {
			isLoading = false;
		}
	}

	function handleResourceClick(resourceId: string) {
		const resource = resources.find(r => r.resourceId === resourceId);
		if (!resource || !currentTenantUrl) return;

		// Open resource in Qlik Cloud based on type
		const baseUrl = currentTenantUrl;
		let url: string;

		switch (resource.resourceType) {
			case 'app':
			case 'app[directQuery,]':
				url = `${baseUrl}/sense/app/${resourceId}`;
				break;
			case 'automation':
				url = `${baseUrl}/automations/${resourceId}`;
				break;
			default:
				url = `${baseUrl}/catalog?resourceId=${resourceId}`;
		}

		window.open(url, '_blank');
	}

	function handleResourceMenuClick(resourceId: string, event: MouseEvent) {
		console.log('Menu clicked for resource:', resourceId);
	}

	// Force refresh - invalidate cache and reload
	async function forceRefresh() {
		resourceCache.invalidate();
		hasStartedLoading = false;
		usingCachedData = false;
		cacheAge = null;
		await loadResourcesAndSpaces();
	}

	function handleResourceSelect(resourceId: string, selected: boolean) {
		if (!onSelectionChange) return;

		if (selected) {
			onSelectionChange([...selectedIds, resourceId]);
		} else {
			onSelectionChange(selectedIds.filter(id => id !== resourceId));
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedSpaceId = null;
		selectedResourceType = null;
	}

	function selectAll() {
		if (!onSelectionChange) return;
		onSelectionChange(filteredResources.map(r => r.resourceId));
	}

	function deselectAll() {
		if (!onSelectionChange) return;
		onSelectionChange([]);
	}

	onMount(() => {
		const unsubscribe = authStore.subscribe(state => {
			if (state.isAuthenticated && !hasStartedLoading) {
				loadResourcesAndSpaces();
			}
		});
		return unsubscribe;
	});

	// Export resources for parent components
	export function getResources() {
		return resources;
	}

	export function getSpaces() {
		return spaces;
	}
</script>

<div class="flex-1 flex flex-col min-h-0 {compactMode ? '' : 'px-4 py-6'}">
	<!-- Header with Search and Filters -->
	{#if !hideFilters}
		<div class="mb-4">
			<div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				{#if !compactMode}
					<h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
						Catalog
					</h1>
				{/if}

				<div class="flex flex-wrap items-center gap-3 {compactMode ? 'w-full' : ''}">
					<!-- Search Input -->
					<div class="relative {compactMode ? 'flex-1' : ''}">
						<svg 
							class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" 
							fill="none" 
							stroke="currentColor" 
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							placeholder="Search resources..."
							bind:value={searchQuery}
							class="pl-9 pr-4 py-2 w-full {compactMode ? '' : 'w-56'} text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
						/>
					</div>

					<!-- Resource Type Filter -->
					<select
						bind:value={selectedResourceType}
						class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
					>
						<option value={null}>All Types</option>
						{#each availableResourceTypes() as type}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>

					{#if !directoryMode}
						<!-- Space Filter (only in non-directory mode) -->
						<select
							bind:value={selectedSpaceId}
							class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
						>
							<option value={null}>All Spaces</option>
							<option value="personal">Personal</option>
							{#each spaces as space (space.id)}
								<option value={space.id}>{space.name}</option>
							{/each}
						</select>

						<!-- Sort Dropdown -->
						<select
							bind:value={sortBy}
							class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
						>
							<option value="updatedAt">Last modified</option>
							<option value="name">Name</option>
						</select>
					{/if}

					{#if searchQuery || selectedSpaceId || selectedResourceType}
						<button
							type="button"
							onclick={clearFilters}
							class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						>
							Clear all
						</button>
					{/if}

					<!-- Refresh Button -->
					<button
						type="button"
						onclick={forceRefresh}
						disabled={isLoading}
						class="p-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
						title="Refresh catalog"
					>
						<svg class="w-4 h-4 {isLoading ? 'animate-spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Selection controls (when selectable) -->
			{#if selectable}
				<div class="mt-3 flex items-center gap-3">
					<span class="text-sm text-gray-600 dark:text-gray-400">
						{selectedIds.length} selected
					</span>
					<button
						type="button"
						onclick={selectAll}
						class="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
					>
						Select all
					</button>
					{#if selectedIds.length > 0}
						<button
							type="button"
							onclick={deselectAll}
							class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						>
							Clear selection
						</button>
					{/if}
					{#if directoryMode}
						<span class="text-gray-300 dark:text-gray-600">|</span>
						<button
							type="button"
							onclick={expandAll}
							class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						>
							Expand all
						</button>
						<button
							type="button"
							onclick={collapseAll}
							class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						>
							Collapse all
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Loading State -->
	{#if isLoading}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-4"></div>
				<p class="text-sm text-gray-600 dark:text-gray-400">Loading resources...</p>
			</div>
		</div>
	{:else if loadError}
		<!-- Error State -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<svg class="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				<p class="mt-4 text-sm text-red-600 dark:text-red-400">{loadError}</p>
				<button
					type="button"
					onclick={() => { hasStartedLoading = false; loadResourcesAndSpaces(); }}
					class="mt-4 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg"
				>
					Retry
				</button>
			</div>
		</div>
	{:else if filteredResources.length === 0}
		<!-- Empty State -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
				</svg>
				<h3 class="mt-4 text-sm font-medium text-gray-900 dark:text-white">No resources found</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{#if searchQuery || selectedSpaceId || selectedResourceType}
						Try adjusting your filters
					{:else}
						No resources are available in your tenant
					{/if}
				</p>
				{#if searchQuery || selectedSpaceId || selectedResourceType}
					<button
						type="button"
						onclick={clearFilters}
						class="mt-4 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
					>
						Clear filters
					</button>
				{/if}
			</div>
		</div>
	{:else if directoryMode}
		<!-- Directory Mode View -->
		<div class="flex-1 overflow-y-auto">
			<div class="space-y-1">
				{#each spacesWithResources as space (space.id)}
					{@const spaceResources = resourcesBySpace.get(space.id) || []}
					{@const isExpanded = expandedSpaces.has(space.id)}
					{@const selectedInSpace = getSelectedCountInSpace(space.id)}
					
					<!-- Space Header -->
					<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
						<button
							type="button"
							onclick={() => toggleSpace(space.id)}
							class="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
						>
							<!-- Expand/Collapse Icon -->
							<svg 
								class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform {isExpanded ? 'rotate-90' : ''}" 
								fill="none" 
								stroke="currentColor" 
								viewBox="0 0 24 24"
							>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
							
							<!-- Folder Icon -->
							<svg class="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
								{#if isExpanded}
									<path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
								{:else}
									<path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H12L10 5H5C3.89543 5 3 5.89543 3 7Z" />
								{/if}
							</svg>
							
							<!-- Space Name -->
							<span class="flex-1 font-medium text-gray-900 dark:text-white">
								{space.name}
							</span>
							
							<!-- Selection indicator -->
							{#if selectable && selectedInSpace > 0}
								<span class="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
									{selectedInSpace} selected
								</span>
							{/if}
							
							<!-- Resource Count -->
							<span class="text-sm text-gray-500 dark:text-gray-400">
								{space.count} {space.count === 1 ? 'item' : 'items'}
							</span>
						</button>
						
						<!-- Expanded Content -->
						{#if isExpanded}
							<div class="border-t border-gray-200 dark:border-gray-700">
								{#if spaceResources.length === 0}
									<div class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
										No resources in this space
									</div>
								{:else}
									<!-- Space-level selection controls -->
									{#if selectable}
										<div class="px-4 py-2 bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
											<button
												type="button"
												onclick={() => {
													if (isSpaceFullySelected(space.id)) {
														deselectAllInSpace(space.id);
													} else {
														selectAllInSpace(space.id);
													}
												}}
												class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
											>
												{#if isSpaceFullySelected(space.id)}
													<svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
														<path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
													</svg>
													Deselect all
												{:else if isSpacePartiallySelected(space.id)}
													<svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24">
														<path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-2 10H7v-2h10v2z"/>
													</svg>
													Select all
												{:else}
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/>
													</svg>
													Select all
												{/if}
											</button>
										</div>
									{/if}
									
									<!-- Resource List -->
									<div class="divide-y divide-gray-100 dark:divide-gray-700/50">
										{#each spaceResources as resource (resource.resourceId)}
											{@const typeInfo = getResourceTypeInfo(resource.resourceType)}
											{@const isSelected = selectedIds.includes(resource.resourceId)}
											<label 
												class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors {selectable ? 'cursor-pointer' : ''}"
											>
												<!-- Checkbox (when selectable) -->
												{#if selectable}
													<input
														type="checkbox"
														class="sr-only"
														checked={isSelected}
														onchange={() => handleResourceSelect(resource.resourceId, !isSelected)}
													/>
													<div class="flex-shrink-0">
														{#if isSelected}
															<div class="w-5 h-5 rounded bg-green-600 flex items-center justify-center">
																<svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
																</svg>
															</div>
														{:else}
															<div class="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600"></div>
														{/if}
													</div>
												{/if}
												
												<!-- Resource Type Icon -->
												<div 
													class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
													style="background-color: {typeInfo.color}20"
												>
													{#if typeInfo.icon === 'chart-bar'}
														<svg class="w-4 h-4" style="color: {typeInfo.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
														</svg>
													{:else if typeInfo.icon === 'cog'}
														<svg class="w-4 h-4" style="color: {typeInfo.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
														</svg>
													{:else if typeInfo.icon === 'table'}
														<svg class="w-4 h-4" style="color: {typeInfo.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
														</svg>
													{:else}
														<svg class="w-4 h-4" style="color: {typeInfo.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
														</svg>
													{/if}
												</div>
												
												<!-- Resource Info -->
												<div class="flex-1 min-w-0">
													<div class="font-medium text-gray-900 dark:text-white truncate">
														{resource.name}
													</div>
													{#if resource.description}
														<div class="text-sm text-gray-500 dark:text-gray-400 truncate">
															{resource.description}
														</div>
													{/if}
												</div>
												
												<!-- Resource Type Badge -->
												<span class="flex-shrink-0 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
													{typeInfo.label}
												</span>
												
												<!-- Open in Qlik button (when not in select mode) -->
												{#if !selectable}
													<button
														type="button"
														onclick={(e) => { e.stopPropagation(); handleResourceClick(resource.resourceId); }}
														class="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
														title="Open in Qlik Cloud"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
														</svg>
													</button>
												{/if}
											</label>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Standard Grid View -->
		<!-- Results Count -->
		<div class="mb-4 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
			<span>Showing {filteredResources.length} of {resources.length} resources</span>
			{#if usingCachedData && cacheAge}
				<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs">
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Cached {cacheAge}
				</span>
			{/if}
		</div>

		<!-- Resources Grid -->
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 overflow-y-auto pb-4">
			{#each filteredResources as resource (resource.resourceId)}
				<ResourceTile
					id={resource.resourceId}
					name={resource.name}
					description={resource.description}
					updatedAt={resource.updatedAt}
					spaceId={resource.spaceId}
					spaceName={getSpaceName(resource.spaceId)}
					resourceType={resource.resourceType}
					thumbnailId={resource.thumbnailId}
					tenantUrl={currentTenantUrl ?? undefined}
					{selectable}
					isSelected={selectedIds.includes(resource.resourceId)}
					onClick={selectable ? undefined : handleResourceClick}
					onMenuClick={handleResourceMenuClick}
					onSelect={handleResourceSelect}
				/>
			{/each}
		</div>
	{/if}
</div>

