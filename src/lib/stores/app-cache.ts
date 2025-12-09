/**
 * IndexedDB-based persistent cache for Qlik app data
 * Keys data by tenant URL and user ID to support multi-tenant/multi-user scenarios
 */

import { browser } from '$app/environment';

const DB_NAME = 'analytics-notebook-cache';
const DB_VERSION = 1;
const APPS_STORE = 'apps';
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
	updatedAt?: string;
	[key: string]: any;
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
	 * Get all cached apps for a tenant/user
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
			} else if (appItem.updatedAt && cached.updatedAt !== appItem.updatedAt) {
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

