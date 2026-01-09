<script lang="ts">
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth';
	import { loadQlikAPI, configureQlikAuthOnce } from '$lib/utils/qlik-auth';
	import ResourceTile from './ResourceTile.svelte';
	import type { ResourceType } from '$lib/types';
	import { RESOURCE_TYPE_INFO } from '$lib/types';

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
		hideFilters?: boolean;
		compactMode?: boolean;
	}

	let {
		selectable = false,
		selectedIds = [],
		onSelectionChange,
		filterResourceTypes,
		hideFilters = false,
		compactMode = false
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

	// Filter and sort resources
	const filteredResources = $derived.by(() => {
		let filtered = resources;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(r => 
				r.name.toLowerCase().includes(query) ||
				r.description?.toLowerCase().includes(query)
			);
		}

		// Filter by space
		if (selectedSpaceId) {
			if (selectedSpaceId === 'personal') {
				filtered = filtered.filter(r => !r.spaceId);
			} else {
				filtered = filtered.filter(r => r.spaceId === selectedSpaceId);
			}
		}

		// Filter by resource type
		if (selectedResourceType) {
			filtered = filtered.filter(r => r.resourceType === selectedResourceType || r.resourceType.startsWith(selectedResourceType));
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

			await configureQlikAuthOnce(tenantUrl);
			const qlikApi = await loadQlikAPI();
			const { items, spaces: spacesApi } = qlikApi;

			const [fetchedResources, fetchedSpaces] = await Promise.all([
				fetchAllResources(items),
				spacesApi ? fetchAllSpaces(spacesApi).catch(() => []) : Promise.resolve([])
			]);

			resources = fetchedResources;
			spaces = fetchedSpaces;

			console.log(`Loaded ${resources.length} resources and ${spaces.length} spaces`);
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

					<!-- Space Filter -->
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

					{#if searchQuery || selectedSpaceId || selectedResourceType}
						<button
							type="button"
							onclick={clearFilters}
							class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
						>
							Clear all
						</button>
					{/if}
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
	{:else}
		<!-- Results Count -->
		<div class="mb-4 text-sm text-gray-500 dark:text-gray-400">
			Showing {filteredResources.length} of {resources.length} resources
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

