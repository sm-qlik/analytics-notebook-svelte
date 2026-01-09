/**
 * Persistent cache for resources and spaces from Qlik Cloud
 * Uses localStorage for persistence across page reloads and sessions
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

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
	type?: string;
}

interface ResourceCacheState {
	resources: ResourceItem[];
	spaces: Space[];
	tenantUrl: string | null;
	lastFetchedAt: number | null;
	isLoading: boolean;
}

const STORAGE_KEY = 'qcs-resource-cache';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours for persistent cache

// Load initial state from localStorage
function loadFromStorage(): ResourceCacheState {
	const defaultState: ResourceCacheState = {
		resources: [],
		spaces: [],
		tenantUrl: null,
		lastFetchedAt: null,
		isLoading: false
	};

	if (!browser) return defaultState;

	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			return {
				...parsed,
				isLoading: false // Always reset loading state on init
			};
		}
	} catch (e) {
		console.warn('Failed to load resource cache from localStorage:', e);
	}

	return defaultState;
}

// Save state to localStorage
function saveToStorage(state: ResourceCacheState): void {
	if (!browser) return;

	try {
		// Don't persist isLoading state
		const toStore = {
			resources: state.resources,
			spaces: state.spaces,
			tenantUrl: state.tenantUrl,
			lastFetchedAt: state.lastFetchedAt
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
	} catch (e) {
		console.warn('Failed to save resource cache to localStorage:', e);
	}
}

function createResourceCacheStore() {
	const initialState = loadFromStorage();
	const { subscribe, set, update } = writable<ResourceCacheState>(initialState);

	return {
		subscribe,

		/**
		 * Check if cache is valid for the given tenant
		 */
		isValid: (tenantUrl: string): boolean => {
			const state = get({ subscribe });
			if (!state.lastFetchedAt) return false;
			if (state.tenantUrl !== tenantUrl) return false;
			const age = Date.now() - state.lastFetchedAt;
			return age < CACHE_DURATION_MS;
		},

		/**
		 * Get cached resources if valid
		 */
		getResources: (tenantUrl: string): ResourceItem[] | null => {
			const state = get({ subscribe });
			if (!state.lastFetchedAt) return null;
			if (state.tenantUrl !== tenantUrl) return null;
			const age = Date.now() - state.lastFetchedAt;
			if (age >= CACHE_DURATION_MS) return null;
			return state.resources;
		},

		/**
		 * Get cached spaces if valid
		 */
		getSpaces: (tenantUrl: string): Space[] | null => {
			const state = get({ subscribe });
			if (!state.lastFetchedAt) return null;
			if (state.tenantUrl !== tenantUrl) return null;
			const age = Date.now() - state.lastFetchedAt;
			if (age >= CACHE_DURATION_MS) return null;
			return state.spaces;
		},

		/**
		 * Set loading state
		 */
		setLoading: (isLoading: boolean): void => {
			update(state => ({ ...state, isLoading }));
		},

		/**
		 * Update cache with new data
		 */
		setData: (tenantUrl: string, resources: ResourceItem[], spaces: Space[]): void => {
			const newState: ResourceCacheState = {
				resources,
				spaces,
				tenantUrl,
				lastFetchedAt: Date.now(),
				isLoading: false
			};
			set(newState);
			saveToStorage(newState);
			console.log(`Cached ${resources.length} resources and ${spaces.length} spaces to localStorage`);
		},

		/**
		 * Clear the cache
		 */
		clear: (): void => {
			const defaultState: ResourceCacheState = {
				resources: [],
				spaces: [],
				tenantUrl: null,
				lastFetchedAt: null,
				isLoading: false
			};
			set(defaultState);
			if (browser) {
				localStorage.removeItem(STORAGE_KEY);
			}
		},

		/**
		 * Invalidate cache (force refetch next time)
		 */
		invalidate: (): void => {
			update(state => {
				const newState = { ...state, lastFetchedAt: null };
				saveToStorage(newState);
				return newState;
			});
		},

		/**
		 * Get cache age in human readable format
		 */
		getCacheAge: (): string | null => {
			const state = get({ subscribe });
			if (!state.lastFetchedAt) return null;
			
			const ageMs = Date.now() - state.lastFetchedAt;
			const minutes = Math.floor(ageMs / 60000);
			const hours = Math.floor(minutes / 60);
			
			if (hours > 0) {
				return `${hours}h ${minutes % 60}m ago`;
			}
			return `${minutes}m ago`;
		}
	};
}

export const resourceCache = createResourceCacheStore();
