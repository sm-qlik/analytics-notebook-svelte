/**
 * IndexedDB-based persistent cache for Qlik app data
 * Keys data by tenant URL and user ID to support multi-tenant/multi-user scenarios
 * 
 * Architecture for large datasets (4000+ apps):
 * - Apps store: Full app structure data (only loaded on demand)
 * - Search index store: Flattened searchable items with proper indexes for filtering
 * - Metadata store: Sync state and app lists
 */

import { browser } from '$app/environment';

const DB_NAME = 'analytics-notebook-cache';
const DB_VERSION = 2; // Bumped for new search index store
const APPS_STORE = 'apps';
const SEARCH_INDEX_STORE = 'searchIndex';
const METADATA_STORE = 'metadata';

export interface CachedAppData {
	id: string; // App ID
	name: string;
	data: any; // App structure data
	updatedAt: string; // ISO timestamp from Qlik API
	cachedAt: number; // Local cache timestamp
	spaceId?: string;
}

export interface CacheMetadata {
	key: string; // composite key: tenantUrl:userId
	lastSyncAt: number; // When we last synced with the API
	appIds: string[]; // List of app IDs we have cached
}

export interface AppItem {
	resourceId: string;
	name: string;
	spaceId?: string;
	updatedAt: string;
	[key: string]: any;
}

/**
 * Searchable item stored in IndexedDB with proper indexes for filtering
 * This is a flattened, lightweight version of the search data
 */
export interface SearchIndexItem {
	id: string;              // Unique ID: tenantUser:appId:path
	tenantUser: string;      // For scoping queries
	appId: string;           // Index for app filtering
	appName: string;
	spaceId: string;         // Index for space filtering (empty string if none)
	sheetId: string;         // Index for sheet filtering (empty string if none)
	sheetName: string;
	sheetUrl: string;
	sheetApproved: boolean;  // Sheet approval status (Public)
	sheetPublished: boolean; // Sheet published status (Community)
	objectType: string;      // Index for type filtering
	title: string;
	labels: string[];
	labelsText: string;      // Joined labels for text search
	searchText: string;      // Concatenated searchable text
	definition: string;      // qDef value
	chartId: string;
	chartTitle: string;
	chartUrl: string;
	path: string;            // Original path for reference
}

/**
 * Filters for querying the search index
 */
export interface SearchFilters {
	tenantUser: string;
	spaceIds?: string[];      // Filter by spaces (empty array = all)
	appIds?: string[];        // Filter by apps (empty array = all)
	sheetIds?: string[];      // Filter by sheets (empty array = all)
	objectTypes?: string[];   // Filter by types (empty array = all)
	searchText?: string;      // Text to search for
	limit?: number;           // Max results to return
	offset?: number;          // For pagination
}

/**
 * Get composite cache key from tenant URL and user ID
 */
export function getCacheKey(tenantUrl: string, userId: string): string {
	// Normalize tenant URL (remove protocol, trailing slashes)
	const normalizedTenant = tenantUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
	return `${normalizedTenant}:${userId}`;
}

/**
 * Get the app cache key (scoped to tenant + user)
 */
function getAppCacheKey(cacheKey: string, appId: string): string {
	return `${cacheKey}:${appId}`;
}

class AppCacheDB {
	private db: IDBDatabase | null = null;
	private dbPromise: Promise<IDBDatabase> | null = null;

	/**
	 * Reset the database connection (useful after version changes)
	 */
	resetConnection(): void {
		if (this.db) {
			this.db.close();
		}
		this.db = null;
		this.dbPromise = null;
	}

	private async openDB(): Promise<IDBDatabase> {
		if (!browser) {
			throw new Error('IndexedDB is only available in browser environment');
		}

		if (this.db) {
			return this.db;
		}

		if (this.dbPromise) {
			return this.dbPromise;
		}

		this.dbPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				console.error('Failed to open IndexedDB:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve(request.result);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const oldVersion = event.oldVersion;

				// Create apps store with compound index
				if (!db.objectStoreNames.contains(APPS_STORE)) {
					const appsStore = db.createObjectStore(APPS_STORE, { keyPath: 'cacheKey' });
					appsStore.createIndex('appId', 'appId', { unique: false });
					appsStore.createIndex('tenantUser', 'tenantUser', { unique: false });
				}

				// Create metadata store
				if (!db.objectStoreNames.contains(METADATA_STORE)) {
					db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
				}

				// Create search index store (new in version 2)
				if (!db.objectStoreNames.contains(SEARCH_INDEX_STORE)) {
					const searchStore = db.createObjectStore(SEARCH_INDEX_STORE, { keyPath: 'id' });
					// Indexes for efficient filtering
					searchStore.createIndex('tenantUser', 'tenantUser', { unique: false });
					searchStore.createIndex('appId', 'appId', { unique: false });
					searchStore.createIndex('spaceId', 'spaceId', { unique: false });
					searchStore.createIndex('sheetId', 'sheetId', { unique: false });
					searchStore.createIndex('objectType', 'objectType', { unique: false });
					// Compound indexes for common filter combinations
					searchStore.createIndex('tenantUser_spaceId', ['tenantUser', 'spaceId'], { unique: false });
					searchStore.createIndex('tenantUser_appId', ['tenantUser', 'appId'], { unique: false });
					searchStore.createIndex('tenantUser_objectType', ['tenantUser', 'objectType'], { unique: false });
				}

				console.log(`IndexedDB upgraded from version ${oldVersion} to ${DB_VERSION}`);
			};
		});

		return this.dbPromise;
	}

	/**
	 * Store app data in the cache
	 */
	async setAppData(
		tenantUrl: string,
		userId: string,
		appId: string,
		appName: string,
		data: any,
		updatedAt: string,
		spaceId?: string
	): Promise<void> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);
		const appCacheKey = getAppCacheKey(cacheKey, appId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([APPS_STORE], 'readwrite');
			const store = transaction.objectStore(APPS_STORE);

			const record: CachedAppData & { cacheKey: string; tenantUser: string; appId: string } = {
				cacheKey: appCacheKey,
				tenantUser: cacheKey,
				appId,
				id: appId,
				name: appName,
				data,
				updatedAt,
				cachedAt: Date.now(),
				spaceId
			};

			const request = store.put(record);

			request.onerror = () => {
				console.error('Failed to store app data:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve();
			};
		});
	}

	/**
	 * Get app data from the cache
	 */
	async getAppData(
		tenantUrl: string,
		userId: string,
		appId: string
	): Promise<CachedAppData | null> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);
		const appCacheKey = getAppCacheKey(cacheKey, appId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([APPS_STORE], 'readonly');
			const store = transaction.objectStore(APPS_STORE);
			const request = store.get(appCacheKey);

			request.onerror = () => {
				console.error('Failed to get app data:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve(request.result || null);
			};
		});
	}

	/**
	 * Get all cached apps for a tenant/user (metadata only, not full data)
	 */
	async getAllCachedApps(
		tenantUrl: string,
		userId: string
	): Promise<CachedAppData[]> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([APPS_STORE], 'readonly');
			const store = transaction.objectStore(APPS_STORE);
			const index = store.index('tenantUser');
			const request = index.getAll(cacheKey);

			request.onerror = () => {
				console.error('Failed to get cached apps:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve(request.result || []);
			};
		});
	}

	/**
	 * Get cached app metadata only (without full structure data) for memory efficiency
	 */
	async getCachedAppMetadata(
		tenantUrl: string,
		userId: string
	): Promise<Array<{ id: string; name: string; spaceId?: string; updatedAt: string }>> {
		const cachedApps = await this.getAllCachedApps(tenantUrl, userId);
		return cachedApps.map(app => ({
			id: app.id,
			name: app.name,
			spaceId: app.spaceId,
			updatedAt: app.updatedAt
		}));
	}

	/**
	 * Remove an app from the cache
	 */
	async removeApp(
		tenantUrl: string,
		userId: string,
		appId: string
	): Promise<void> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);
		const appCacheKey = getAppCacheKey(cacheKey, appId);

		// Also remove search index items for this app
		await this.removeSearchIndexForApp(tenantUrl, userId, appId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([APPS_STORE], 'readwrite');
			const store = transaction.objectStore(APPS_STORE);
			const request = store.delete(appCacheKey);

			request.onerror = () => {
				console.error('Failed to remove app:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve();
			};
		});
	}

	/**
	 * Remove multiple apps from the cache
	 */
	async removeApps(
		tenantUrl: string,
		userId: string,
		appIds: string[]
	): Promise<void> {
		if (appIds.length === 0) return;

		// Remove search index items for these apps
		for (const appId of appIds) {
			await this.removeSearchIndexForApp(tenantUrl, userId, appId);
		}

		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([APPS_STORE], 'readwrite');
			const store = transaction.objectStore(APPS_STORE);

			let completed = 0;
			let hasError = false;

			for (const appId of appIds) {
				const appCacheKey = getAppCacheKey(cacheKey, appId);
				const request = store.delete(appCacheKey);

				request.onerror = () => {
					if (!hasError) {
						hasError = true;
						console.error('Failed to remove app:', request.error);
						reject(request.error);
					}
				};

				request.onsuccess = () => {
					completed++;
					if (completed === appIds.length && !hasError) {
						resolve();
					}
				};
			}
		});
	}

	/**
	 * Clear all cached data for a tenant/user
	 */
	async clearCache(tenantUrl: string, userId: string): Promise<void> {
		const cachedApps = await this.getAllCachedApps(tenantUrl, userId);
		const appIds = cachedApps.map(app => app.id);
		await this.removeApps(tenantUrl, userId, appIds);
		await this.clearSearchIndex(tenantUrl, userId);
		await this.clearMetadata(tenantUrl, userId);
	}

	/**
	 * Store sync metadata
	 */
	async setMetadata(
		tenantUrl: string,
		userId: string,
		appIds: string[]
	): Promise<void> {
		const db = await this.openDB();
		const key = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([METADATA_STORE], 'readwrite');
			const store = transaction.objectStore(METADATA_STORE);

			const metadata: CacheMetadata = {
				key,
				lastSyncAt: Date.now(),
				appIds
			};

			const request = store.put(metadata);

			request.onerror = () => {
				console.error('Failed to store metadata:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve();
			};
		});
	}

	/**
	 * Get sync metadata
	 */
	async getMetadata(tenantUrl: string, userId: string): Promise<CacheMetadata | null> {
		const db = await this.openDB();
		const key = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([METADATA_STORE], 'readonly');
			const store = transaction.objectStore(METADATA_STORE);
			const request = store.get(key);

			request.onerror = () => {
				console.error('Failed to get metadata:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve(request.result || null);
			};
		});
	}

	/**
	 * Clear metadata for a tenant/user
	 */
	async clearMetadata(tenantUrl: string, userId: string): Promise<void> {
		const db = await this.openDB();
		const key = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([METADATA_STORE], 'readwrite');
			const store = transaction.objectStore(METADATA_STORE);
			const request = store.delete(key);

			request.onerror = () => {
				console.error('Failed to clear metadata:', request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				resolve();
			};
		});
	}

	/**
	 * Determine which apps need to be updated based on their updatedAt timestamps
	 */
	async getAppsToUpdate(
		tenantUrl: string,
		userId: string,
		currentAppItems: AppItem[]
	): Promise<{
		toLoad: AppItem[]; // Apps that need to be loaded (new or updated)
		toRemove: string[]; // App IDs that should be removed (no longer exist)
		unchanged: CachedAppData[]; // Apps that haven't changed
	}> {
		const cachedApps = await this.getAllCachedApps(tenantUrl, userId);
		const cachedAppMap = new Map(cachedApps.map(app => [app.id, app]));
		const currentAppIds = new Set(currentAppItems.map(item => item.resourceId));

		const toLoad: AppItem[] = [];
		const unchanged: CachedAppData[] = [];
		const toRemove: string[] = [];

		// Check which apps need to be loaded or are unchanged
		for (const appItem of currentAppItems) {
			const cached = cachedAppMap.get(appItem.resourceId);

			if (!cached) {
				// App not in cache - needs to be loaded
				toLoad.push(appItem);
			} else if (cached.updatedAt !== appItem.updatedAt) {
				// App has been updated - needs to be reloaded
				toLoad.push(appItem);
			} else {
				// App hasn't changed - use cached data
				unchanged.push(cached);
			}
		}

		// Check which cached apps should be removed (no longer in API response)
		for (const cachedApp of cachedApps) {
			if (!currentAppIds.has(cachedApp.id)) {
				toRemove.push(cachedApp.id);
			}
		}

		return { toLoad, toRemove, unchanged };
	}

	/**
	 * Lightweight version that only loads metadata for comparison (not full structure data)
	 * Much faster when you just need to know what changed vs unchanged
	 */
	async getAppsToUpdateLightweight(
		tenantUrl: string,
		userId: string,
		currentAppItems: AppItem[]
	): Promise<{
		toLoad: AppItem[]; // Apps that need to be loaded (new or updated)
		toRemove: string[]; // App IDs that should be removed (no longer exist)
		unchangedMetadata: Array<{ id: string; name: string; spaceId?: string; updatedAt: string }>; // Lightweight metadata only
	}> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		// Only load metadata fields, not full structure data
		const cachedMetadata = await new Promise<Array<{ id: string; name: string; spaceId?: string; updatedAt: string }>>((resolve, reject) => {
			const transaction = db.transaction([APPS_STORE], 'readonly');
			const store = transaction.objectStore(APPS_STORE);
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(cacheKey));

			const metadata: Array<{ id: string; name: string; spaceId?: string; updatedAt: string }> = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					// Only extract metadata fields, skip the heavy 'data' field
					const record = cursor.value;
					metadata.push({
						id: record.id || record.appId,
						name: record.name,
						spaceId: record.spaceId,
						updatedAt: record.updatedAt
					});
					cursor.continue();
				} else {
					resolve(metadata);
				}
			};

			request.onerror = () => reject(request.error);
		});

		const cachedAppMap = new Map(cachedMetadata.map(app => [app.id, app]));
		const currentAppIds = new Set(currentAppItems.map(item => item.resourceId));

		const toLoad: AppItem[] = [];
		const unchangedMetadata: Array<{ id: string; name: string; spaceId?: string; updatedAt: string }> = [];
		const toRemove: string[] = [];

		// Check which apps need to be loaded or are unchanged
		for (const appItem of currentAppItems) {
			const cached = cachedAppMap.get(appItem.resourceId);

			if (!cached) {
				// App not in cache - needs to be loaded
				toLoad.push(appItem);
			} else if (cached.updatedAt !== appItem.updatedAt) {
				// App has been updated - needs to be reloaded
				toLoad.push(appItem);
			} else {
				// App hasn't changed - keep the lightweight metadata
				unchangedMetadata.push(cached);
			}
		}

		// Check which cached apps should be removed (no longer in API response)
		for (const cachedApp of cachedMetadata) {
			if (!currentAppIds.has(cachedApp.id)) {
				toRemove.push(cachedApp.id);
			}
		}

		return { toLoad, toRemove, unchangedMetadata };
	}

	// ============================================
	// Search Index Methods
	// ============================================

	/**
	 * Store multiple search index items in a batch
	 */
	async addSearchIndexItems(items: SearchIndexItem[]): Promise<void> {
		if (items.length === 0) return;

		const db = await this.openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);

			let completed = 0;
			let hasError = false;

			transaction.oncomplete = () => {
				resolve();
			};

			transaction.onerror = () => {
				if (!hasError) {
					hasError = true;
					console.error('Failed to add search index items:', transaction.error);
					reject(transaction.error);
				}
			};

			for (const item of items) {
				store.put(item);
			}
		});
	}

	/**
	 * Remove all search index items for a specific app
	 */
	async removeSearchIndexForApp(
		tenantUrl: string,
		userId: string,
		appId: string
	): Promise<void> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('appId');
			const request = index.openCursor(IDBKeyRange.only(appId));

			const keysToDelete: IDBValidKey[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					// Check if this item belongs to our tenant/user
					if (cursor.value.tenantUser === cacheKey) {
						keysToDelete.push(cursor.primaryKey);
					}
					cursor.continue();
				} else {
					// Delete all matching keys
					let deleted = 0;
					if (keysToDelete.length === 0) {
						resolve();
						return;
					}
					for (const key of keysToDelete) {
						const deleteRequest = store.delete(key);
						deleteRequest.onsuccess = () => {
							deleted++;
							if (deleted === keysToDelete.length) {
								resolve();
							}
						};
						deleteRequest.onerror = () => {
							reject(deleteRequest.error);
						};
					}
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Clear all search index items for a tenant/user
	 */
	async clearSearchIndex(tenantUrl: string, userId: string): Promise<void> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(cacheKey));

			const keysToDelete: IDBValidKey[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					keysToDelete.push(cursor.primaryKey);
					cursor.continue();
				} else {
					// Delete all matching keys
					if (keysToDelete.length === 0) {
						resolve();
						return;
					}
					let deleted = 0;
					for (const key of keysToDelete) {
						const deleteRequest = store.delete(key);
						deleteRequest.onsuccess = () => {
							deleted++;
							if (deleted === keysToDelete.length) {
								resolve();
							}
						};
						deleteRequest.onerror = () => {
							reject(deleteRequest.error);
						};
					}
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Query search index with filters - efficient filtering via IndexedDB indexes
	 * Returns results in batches to avoid memory issues
	 */
	async querySearchIndex(filters: SearchFilters): Promise<SearchIndexItem[]> {
		const db = await this.openDB();
		// Only apply limit if explicitly provided
		const limit = filters.limit;
		const offset = filters.offset || 0;
		
		// Normalize search text for case-insensitive matching
		const searchTextLower = filters.searchText?.toLowerCase().trim() || '';

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readonly');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			
			// Use tenantUser index as the base - always required
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(filters.tenantUser));

			const results: SearchIndexItem[] = [];
			let skipped = 0;

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				
				// Continue if we have a cursor and either no limit or haven't reached it
				if (cursor && (limit === undefined || results.length < limit)) {
					const item: SearchIndexItem = cursor.value;
					
					// Apply filters
					let matches = true;

					// Space filter
					if (filters.spaceIds && filters.spaceIds.length > 0) {
						if (!filters.spaceIds.includes(item.spaceId)) {
							matches = false;
						}
					}

					// App filter
					if (matches && filters.appIds && filters.appIds.length > 0) {
						if (!filters.appIds.includes(item.appId)) {
							matches = false;
						}
					}

					// Sheet filter
					if (matches && filters.sheetIds && filters.sheetIds.length > 0) {
						if (!filters.sheetIds.includes(item.sheetId)) {
							matches = false;
						}
					}

					// Type filter
					if (matches && filters.objectTypes && filters.objectTypes.length > 0) {
						if (!filters.objectTypes.includes(item.objectType)) {
							matches = false;
						}
					}

					// Text search filter (case-insensitive contains)
					if (matches && searchTextLower) {
						const searchableContent = (
							item.searchText + ' ' + 
							item.title + ' ' + 
							item.labelsText + ' ' +
							item.definition + ' ' +
							item.appName + ' ' +
							item.sheetName + ' ' +
							item.chartTitle
						).toLowerCase();
						
						if (!searchableContent.includes(searchTextLower)) {
							matches = false;
						}
					}

					if (matches) {
						if (skipped < offset) {
							skipped++;
						} else {
							results.push(item);
						}
					}

					cursor.continue();
				} else {
					resolve(results);
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Get count of search index items matching filters
	 */
	async countSearchIndex(filters: SearchFilters): Promise<number> {
		const db = await this.openDB();
		const searchTextLower = filters.searchText?.toLowerCase().trim() || '';

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readonly');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(filters.tenantUser));

			let count = 0;

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				
				if (cursor) {
					const item: SearchIndexItem = cursor.value;
					let matches = true;

					if (filters.spaceIds && filters.spaceIds.length > 0) {
						if (!filters.spaceIds.includes(item.spaceId)) matches = false;
					}
					if (matches && filters.appIds && filters.appIds.length > 0) {
						if (!filters.appIds.includes(item.appId)) matches = false;
					}
					if (matches && filters.sheetIds && filters.sheetIds.length > 0) {
						if (!filters.sheetIds.includes(item.sheetId)) matches = false;
					}
					if (matches && filters.objectTypes && filters.objectTypes.length > 0) {
						if (!filters.objectTypes.includes(item.objectType)) matches = false;
					}
					if (matches && searchTextLower) {
						const searchableContent = (
							item.searchText + ' ' + item.title + ' ' + item.labelsText + ' ' +
							item.definition + ' ' + item.appName + ' ' + item.sheetName
						).toLowerCase();
						if (!searchableContent.includes(searchTextLower)) matches = false;
					}

					if (matches) count++;
					cursor.continue();
				} else {
					resolve(count);
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Get unique values for a field (for building filter options)
	 */
	async getUniqueValues(
		tenantUrl: string,
		userId: string,
		field: 'objectType' | 'spaceId' | 'appId' | 'sheetId'
	): Promise<string[]> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readonly');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(cacheKey));

			const values = new Set<string>();

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				
				if (cursor) {
					const value = cursor.value[field];
					if (value) {
						values.add(value);
					}
					cursor.continue();
				} else {
					resolve(Array.from(values).sort());
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Check if search index exists for a tenant/user
	 */
	async hasSearchIndex(tenantUrl: string, userId: string): Promise<boolean> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readonly');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('tenantUser');
			const request = index.count(IDBKeyRange.only(cacheKey));

			request.onsuccess = () => {
				resolve(request.result > 0);
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Get unique sheets from the search index (much faster than re-processing app data)
	 * Returns sheet info extracted from indexed search items
	 */
	async getSheetsFromSearchIndex(
		tenantUrl: string,
		userId: string
	): Promise<Array<{ sheetId: string; sheetName: string; appId: string; appName: string; approved: boolean; published: boolean }>> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readonly');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(cacheKey));

			const sheetsMap = new Map<string, { sheetId: string; sheetName: string; appId: string; appName: string; approved: boolean; published: boolean }>();

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				
				if (cursor) {
					const item: SearchIndexItem = cursor.value;
					// Only add if this item has sheet info and we haven't seen this sheet yet
					if (item.sheetId && !sheetsMap.has(item.sheetId)) {
						sheetsMap.set(item.sheetId, {
							sheetId: item.sheetId,
							sheetName: item.sheetName,
							appId: item.appId,
							appName: item.appName,
							approved: item.sheetApproved ?? false,
							published: item.sheetPublished ?? false
						});
					}
					cursor.continue();
				} else {
					resolve(Array.from(sheetsMap.values()));
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Get app IDs that have entries in the search index
	 */
	async getIndexedAppIds(tenantUrl: string, userId: string): Promise<Set<string>> {
		const db = await this.openDB();
		const cacheKey = getCacheKey(tenantUrl, userId);

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([SEARCH_INDEX_STORE], 'readonly');
			const store = transaction.objectStore(SEARCH_INDEX_STORE);
			const index = store.index('tenantUser');
			const request = index.openCursor(IDBKeyRange.only(cacheKey));

			const appIds = new Set<string>();

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				
				if (cursor) {
					const item: SearchIndexItem = cursor.value;
					appIds.add(item.appId);
					cursor.continue();
				} else {
					resolve(appIds);
				}
			};

			request.onerror = () => {
				reject(request.error);
			};
		});
	}

	/**
	 * Get all cached tenant/user combinations with stats
	 * Discovers tenants from apps store (not just metadata) to handle cases where
	 * metadata wasn't saved yet (e.g., loading interrupted)
	 */
	async listCachedTenants(): Promise<Array<{
		cacheKey: string;
		tenantUrl: string;
		userId: string;
		appCount: number;
		searchIndexCount: number;
		lastSyncAt: number | null;
	}>> {
		if (!browser) return [];
		
		const db = await this.openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([METADATA_STORE, APPS_STORE, SEARCH_INDEX_STORE], 'readonly');
			const metadataStore = transaction.objectStore(METADATA_STORE);
			const appsStore = transaction.objectStore(APPS_STORE);
			const searchStore = transaction.objectStore(SEARCH_INDEX_STORE);

			// First, discover all unique tenantUser keys from apps store
			const appsRequest = appsStore.getAll();

			appsRequest.onsuccess = async () => {
				const apps = appsRequest.result || [];
				
				// Get unique tenantUser keys from apps
				const tenantUserKeys = new Set<string>();
				apps.forEach((app: any) => {
					if (app.tenantUser) {
						tenantUserKeys.add(app.tenantUser);
					}
				});

				// Also check search index for any additional tenantUser keys
				const searchRequest = searchStore.index('tenantUser').openKeyCursor();
				const searchKeys = new Set<string>();
				
				await new Promise<void>((res) => {
					searchRequest.onsuccess = (event) => {
						const cursor = (event.target as IDBRequest<IDBCursor>).result;
						if (cursor) {
							searchKeys.add(cursor.key as string);
							cursor.continue();
						} else {
							res();
						}
					};
					searchRequest.onerror = () => res();
				});

				// Merge keys
				searchKeys.forEach(key => tenantUserKeys.add(key));

				// Get metadata for lastSyncAt timestamps
				const metadataRequest = metadataStore.getAll();
				const metadataMap = new Map<string, CacheMetadata>();
				
				await new Promise<void>((res) => {
					metadataRequest.onsuccess = () => {
						const entries: CacheMetadata[] = metadataRequest.result || [];
						entries.forEach(m => metadataMap.set(m.key, m));
						res();
					};
					metadataRequest.onerror = () => res();
				});

				const results: Array<{
					cacheKey: string;
					tenantUrl: string;
					userId: string;
					appCount: number;
					searchIndexCount: number;
					lastSyncAt: number | null;
				}> = [];

				// Process each discovered tenant/user
				for (const cacheKey of tenantUserKeys) {
					// Parse tenant URL and user ID from cache key
					const parts = cacheKey.split(':');
					const userId = parts.pop() || '';
					const tenantUrl = parts.join(':');

					// Count apps for this tenant/user
					const appsIndex = appsStore.index('tenantUser');
					const appCountRequest = appsIndex.count(IDBKeyRange.only(cacheKey));
					
					const appCount = await new Promise<number>((res) => {
						appCountRequest.onsuccess = () => res(appCountRequest.result);
						appCountRequest.onerror = () => res(0);
					});

					// Count search index items
					const searchIndex = searchStore.index('tenantUser');
					const searchCountRequest = searchIndex.count(IDBKeyRange.only(cacheKey));

					const searchIndexCount = await new Promise<number>((res) => {
						searchCountRequest.onsuccess = () => res(searchCountRequest.result);
						searchCountRequest.onerror = () => res(0);
					});

					// Get metadata if it exists
					const metadata = metadataMap.get(cacheKey);

					results.push({
						cacheKey,
						tenantUrl,
						userId,
						appCount,
						searchIndexCount,
						lastSyncAt: metadata?.lastSyncAt || null
					});
				}

				resolve(results);
			};

			appsRequest.onerror = () => {
				reject(appsRequest.error);
			};
		});
	}

	/**
	 * Delete all data for a specific tenant/user
	 */
	async deleteTenantData(cacheKey: string): Promise<void> {
		if (!browser) return;

		const db = await this.openDB();

		return new Promise((resolve, reject) => {
			const transaction = db.transaction([METADATA_STORE, APPS_STORE, SEARCH_INDEX_STORE], 'readwrite');
			const metadataStore = transaction.objectStore(METADATA_STORE);
			const appsStore = transaction.objectStore(APPS_STORE);
			const searchStore = transaction.objectStore(SEARCH_INDEX_STORE);

			let deletedCount = 0;
			let errors: Error[] = [];

			// Delete metadata
			const metadataRequest = metadataStore.delete(cacheKey);
			metadataRequest.onerror = () => errors.push(metadataRequest.error as Error);

			// Delete all apps for this tenant/user using cursor
			const appsIndex = appsStore.index('tenantUser');
			const appsCursorRequest = appsIndex.openCursor(IDBKeyRange.only(cacheKey));

			appsCursorRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					cursor.delete();
					deletedCount++;
					cursor.continue();
				}
			};

			// Delete all search index items for this tenant/user using cursor
			const searchIndex = searchStore.index('tenantUser');
			const searchCursorRequest = searchIndex.openCursor(IDBKeyRange.only(cacheKey));

			searchCursorRequest.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (cursor) {
					cursor.delete();
					cursor.continue();
				}
			};

			transaction.oncomplete = () => {
				console.log(`Deleted ${deletedCount} items for tenant: ${cacheKey}`);
				resolve();
			};

			transaction.onerror = () => {
				reject(transaction.error);
			};
		});
	}
}

// Export singleton instance
export const appCache = new AppCacheDB();

/**
 * Helper to determine if we should use the cache
 * (e.g., cache is considered valid if last sync was within 24 hours)
 */
export function isCacheValid(metadata: CacheMetadata | null, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean {
	if (!metadata) return false;
	const age = Date.now() - metadata.lastSyncAt;
	return age < maxAgeMs;
}
