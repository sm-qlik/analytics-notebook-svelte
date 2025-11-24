/**
 * Authentication state store for Qlik Cloud
 */
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface AuthState {
	isAuthenticated: boolean;
	tenantUrl: string | null;
	tenantName: string | null;
	user: any | null;
	items: any[] | null;
}

const STORAGE_KEY = 'qlik-auth-state';

function createAuthStore() {
	const defaultState: AuthState = {
		isAuthenticated: false,
		tenantUrl: null,
		tenantName: null,
		user: null,
		items: null
	};

	// Load initial state from localStorage if available
	let initialState = defaultState;
	if (browser) {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				// Only restore tenant URL, not full auth state
				initialState = {
					...defaultState,
					tenantUrl: parsed.tenantUrl || null
				};
			}
		} catch (e) {
			console.warn('Failed to load auth state from localStorage:', e);
		}
	}

	const { subscribe, set, update } = writable<AuthState>(initialState);

	return {
		subscribe,
		set,
		update,
		// Helper methods
		setAuthenticated: (tenantUrl: string, tenantName: string | null = null, user: any = null, items: any[] = null) => {
			const newState: AuthState = {
				isAuthenticated: true,
				tenantUrl,
				tenantName,
				user,
				items
			};
			set(newState);
			if (browser) {
				try {
					// Only store tenant URL, not sensitive auth data
					localStorage.setItem(STORAGE_KEY, JSON.stringify({ tenantUrl }));
				} catch (e) {
					console.warn('Failed to save auth state to localStorage:', e);
				}
			}
		},
		logout: () => {
			set(defaultState);
			if (browser) {
				try {
					localStorage.removeItem(STORAGE_KEY);
					// Also clear any Qlik API tokens
					localStorage.removeItem('qlik-access-token');
					sessionStorage.removeItem('qlik-access-token');
				} catch (e) {
					console.warn('Failed to clear auth state from localStorage:', e);
				}
			}
		}
	};
}

export const authStore = createAuthStore();

