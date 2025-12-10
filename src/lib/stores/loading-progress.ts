/**
 * Store for sharing loading progress state between Search component and header
 */
import { writable } from 'svelte/store';

export interface LoadingProgress {
	current: number;
	total: number;
	currentApp: string;
	isLoading: boolean;
	hasNewData: boolean;
	cachedCount: number;
	failedCount: number;
	isPaused: boolean;
	pendingCount: number;
	appItemsCount: number;
	onRefreshTable?: () => void;
	onRefreshChartFinder?: () => void;
	onCheckForUpdates?: () => void;
}

const defaultState: LoadingProgress = {
	current: 0,
	total: 0,
	currentApp: '',
	isLoading: false,
	hasNewData: false,
	cachedCount: 0,
	failedCount: 0,
	isPaused: false,
	pendingCount: 0,
	appItemsCount: 0,
	onRefreshTable: undefined,
	onRefreshChartFinder: undefined,
	onCheckForUpdates: undefined
};

const { subscribe, set, update } = writable<LoadingProgress>(defaultState);

export const loadingProgressStore = {
	subscribe,
	setProgress(progress: Partial<LoadingProgress>) {
		update(state => ({ ...state, ...progress }));
	},
	setCallbacks(callbacks: { onRefreshTable?: () => void; onRefreshChartFinder?: () => void; onCheckForUpdates?: () => void }) {
		update(state => ({ ...state, ...callbacks }));
	},
	reset() {
		set({
			...defaultState,
			onRefreshTable: undefined,
			onRefreshChartFinder: undefined,
			onCheckForUpdates: undefined
		});
	}
};

