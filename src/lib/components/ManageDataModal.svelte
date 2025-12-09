<script lang="ts">
	import { appCache, getCacheKey } from '$lib/stores/app-cache';
	import { onMount } from 'svelte';

	interface Props {
		isOpen: boolean;
		currentTenantUrl?: string;
		currentUserId?: string;
		onClose: () => void;
		onDataDeleted: (cacheKey: string, isCurrentTenant: boolean) => void;
	}

	let { isOpen, currentTenantUrl, currentUserId, onClose, onDataDeleted }: Props = $props();

	interface CachedTenant {
		cacheKey: string;
		tenantUrl: string;
		userId: string;
		appCount: number;
		searchIndexCount: number;
		lastSyncAt: number | null;
	}

	let cachedTenants = $state<CachedTenant[]>([]);
	let isLoading = $state(true);
	let deletingCacheKey = $state<string | null>(null);

	const currentCacheKey = $derived(
		currentTenantUrl && currentUserId 
			? getCacheKey(currentTenantUrl, currentUserId) 
			: null
	);

	async function loadCachedTenants() {
		isLoading = true;
		try {
			cachedTenants = await appCache.listCachedTenants();
		} catch (err) {
			console.error('Failed to load cached tenants:', err);
			cachedTenants = [];
		} finally {
			isLoading = false;
		}
	}

	async function deleteTenantData(tenant: CachedTenant) {
		if (deletingCacheKey) return;
		
		deletingCacheKey = tenant.cacheKey;
		try {
			await appCache.deleteTenantData(tenant.cacheKey);
			
			// Check if this was the current tenant
			const isCurrentTenant = tenant.cacheKey === currentCacheKey;
			
			// Remove from list
			cachedTenants = cachedTenants.filter(t => t.cacheKey !== tenant.cacheKey);
			
			// Notify parent
			onDataDeleted(tenant.cacheKey, isCurrentTenant);
		} catch (err) {
			console.error('Failed to delete tenant data:', err);
		} finally {
			deletingCacheKey = null;
		}
	}

	function formatDate(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleString();
	}

	function formatCount(count: number): string {
		if (count >= 1000000) {
			return `${(count / 1000000).toFixed(1)}M`;
		}
		if (count >= 1000) {
			return `${(count / 1000).toFixed(1)}K`;
		}
		return count.toString();
	}

	$effect(() => {
		if (isOpen) {
			loadCachedTenants();
		}
	});

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
	<!-- Backdrop -->
	<div 
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleBackdropClick}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<!-- Modal -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 id="modal-title" class="text-lg font-semibold text-gray-900 dark:text-white">
					Manage Cached Data
				</h2>
				<button
					onclick={onClose}
					class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
					aria-label="Close"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-auto p-6">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
						<span class="ml-3 text-gray-600 dark:text-gray-400">Loading cached data...</span>
					</div>
				{:else if cachedTenants.length === 0}
					<div class="text-center py-8">
						<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
						</svg>
						<p class="mt-2 text-gray-600 dark:text-gray-400">No cached data found</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each cachedTenants as tenant (tenant.cacheKey)}
							<div 
								class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border {tenant.cacheKey === currentCacheKey ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-600'}"
							>
								<div class="flex-1 min-w-0 mr-4">
									<div class="flex items-center gap-2">
										<p class="text-sm font-medium text-gray-900 dark:text-white truncate">
											{tenant.tenantUrl}
										</p>
										{#if tenant.cacheKey === currentCacheKey}
											<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
												Active
											</span>
										{/if}
									</div>
									<p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
										User: {tenant.userId}
									</p>
									<div class="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
										<span class="flex items-center gap-1">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											{formatCount(tenant.appCount)} apps
										</span>
										<span class="flex items-center gap-1">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
											</svg>
											{formatCount(tenant.searchIndexCount)} indexed items
										</span>
										<span class="flex items-center gap-1">
											<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											{formatDate(tenant.lastSyncAt)}
										</span>
									</div>
								</div>
								<button
									onclick={() => deleteTenantData(tenant)}
									disabled={deletingCacheKey !== null}
									class="flex-shrink-0 p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									aria-label="Delete cached data for {tenant.tenantUrl}"
									title="Delete all cached data for this tenant"
								>
									{#if deletingCacheKey === tenant.cacheKey}
										<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
									{:else}
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
										</svg>
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Cached data is stored locally in your browser to speed up loading. Deleting cached data will require re-indexing when you next access that tenant.
				</p>
			</div>
		</div>
	</div>
{/if}

