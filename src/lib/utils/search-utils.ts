/**
 * Utility functions for search functionality.
 * These functions are pure and can be easily unit tested.
 */

import type { SearchResultItem } from './search-result-item';
import type { SearchIndexItem } from '../stores/app-cache';
import { safeExtractQDef, extractStringLabels, extractChartTitle } from './data-extraction';

/**
 * Special ID for "Personal" space (apps with no spaceId)
 */
export const PERSONAL_SPACE_ID = '__personal__';

/**
 * Creates a new Set from an existing Set (for Svelte reactivity).
 */
export function createNewSet<T>(oldSet: Set<T>): Set<T> {
	return new Set(oldSet);
}

/**
 * Determines the sheet state based on approved and published status.
 * @param metadata - Sheet metadata with approved and published flags
 * @returns The sheet state: 'Public', 'Community', or 'Private'
 */
export function getSheetStateFromMetadata(metadata: { approved: boolean; published: boolean } | null): 'Public' | 'Community' | 'Private' | null {
	if (!metadata) return null;
	if (metadata.approved) return 'Public';
	if (metadata.published) return 'Community';
	return 'Private';
}

/**
 * Checks if an app matches the current space filter.
 * @param appSpaceId - The app's space ID (undefined for personal space)
 * @param selectedSpaces - Set of selected space IDs
 * @returns True if the app matches the filter
 */
export function appMatchesSpaceFilter(appSpaceId: string | undefined, selectedSpaces: Set<string>): boolean {
	// If no spaces selected, all apps match
	if (selectedSpaces.size === 0) return true;
	
	// Check if "Personal" is selected and app has no space
	const personalSelected = selectedSpaces.has(PERSONAL_SPACE_ID);
	const appHasNoSpace = !appSpaceId;
	
	if (personalSelected && appHasNoSpace) return true;
	if (appSpaceId && selectedSpaces.has(appSpaceId)) return true;
	
	return false;
}

/**
 * Builds search filters from selected filter sets.
 */
export interface SearchFilterInputs {
	selectedSpaces: Set<string>;
	selectedApps: Set<string>;
	selectedSheets: Set<string>;
	selectedTypes: Set<string>;
	searchQuery: string;
	cacheKey: string;
}

/**
 * Converts filter sets to filter arrays for IndexedDB queries.
 */
export function buildSearchFilters(inputs: SearchFilterInputs) {
	const spaceIdsFilter = inputs.selectedSpaces.size > 0 
		? Array.from(inputs.selectedSpaces).map(id => id === PERSONAL_SPACE_ID ? '' : id)
		: undefined;
	
	const appIdsFilter = inputs.selectedApps.size > 0 
		? Array.from(inputs.selectedApps)
		: undefined;

	const sheetIdsFilter = inputs.selectedSheets.size > 0
		? Array.from(inputs.selectedSheets)
		: undefined;

	const typeFilter = inputs.selectedTypes.size > 0
		? Array.from(inputs.selectedTypes)
		: undefined;

	return {
		tenantUser: inputs.cacheKey,
		spaceIds: spaceIdsFilter,
		appIds: appIdsFilter,
		sheetIds: sheetIdsFilter,
		objectTypes: typeFilter,
		searchText: inputs.searchQuery.trim() || undefined
	};
}

/**
 * Converts IndexedDB search index items to SearchResultItem format.
 */
export function convertIndexResultsToSearchResults(indexResults: any[]): SearchResultItem[] {
	return indexResults.map(item => ({
		path: item.path,
		object: { qDef: item.definition, title: item.title, qFieldLabels: item.name },
		objectType: item.objectType,
		context: {},
		file: item.appId,
		app: item.appName,
		appId: item.appId,
		sheet: item.sheetName || null,
		sheetName: item.sheetName || null,
		sheetId: item.sheetId || null,
		sheetUrl: item.sheetUrl || null,
		chartId: item.chartId || null,
		chartTitle: item.chartTitle || null,
		chartUrl: item.chartUrl || null,
		name: item.name
	}));
}

/**
 * Creates a SearchIndexItem for a master dimension.
 */
export function createMasterDimensionIndexItem(
	cacheKey: string,
	appId: string,
	appName: string,
	spaceId: string,
	dim: any,
	idx: number
): SearchIndexItem {
	const path = `masterDimensions[${idx}].qDim`;
	const id = `${cacheKey}:${appId}:${path}`;
	
	const labels = dim.qDim.qFieldLabels || [];
	const title = dim.qMetaDef?.title || dim.qDim.qLabel || '';
	const definition = safeExtractQDef(dim.qDim.qFieldDefs) || safeExtractQDef(dim.qDim);
	const stringLabels = extractStringLabels(labels);

	return {
		id,
		tenantUser: cacheKey,
		appId,
		appName,
		spaceId: spaceId || '',
		sheetId: '',
		sheetName: '',
		sheetUrl: '',
		sheetApproved: false,
		sheetPublished: false,
		objectType: 'Master Dimension',
		title: typeof title === 'string' ? title : '',
		name: stringLabels,
		nameText: stringLabels.join(' '),
		searchText: `${title} ${definition} ${stringLabels.join(' ')}`.trim(),
		definition,
		chartId: '',
		chartTitle: '',
		chartUrl: '',
		path
	};
}

/**
 * Creates a SearchIndexItem for a master measure.
 */
export function createMasterMeasureIndexItem(
	cacheKey: string,
	appId: string,
	appName: string,
	spaceId: string,
	measure: any,
	idx: number
): SearchIndexItem {
	const path = `masterMeasures[${idx}].qMeasure`;
	const id = `${cacheKey}:${appId}:${path}`;
	
	// Extract title - try multiple sources, prioritizing qMeasure.qLabel
	let title = '';
	
	// First try qMeasure.qLabel (most common for master measures)
	if (measure.qMeasure?.qLabel) {
		if (typeof measure.qMeasure.qLabel === 'string' && measure.qMeasure.qLabel.trim()) {
			title = measure.qMeasure.qLabel.trim();
		} else if (measure.qMeasure.qLabel.qv && typeof measure.qMeasure.qLabel.qv === 'string' && measure.qMeasure.qLabel.qv.trim()) {
			title = measure.qMeasure.qLabel.qv.trim();
		}
	}
	
	// Fallback to qMetaDef.title if qLabel didn't yield a result
	if (!title && measure.qMetaDef?.title && typeof measure.qMetaDef.title === 'string' && measure.qMetaDef.title.trim()) {
		title = measure.qMetaDef.title.trim();
	}
	
	// Fallback to qTitle if still no title
	if (!title && measure.qMeasure?.qTitle) {
		if (typeof measure.qMeasure.qTitle === 'string' && measure.qMeasure.qTitle.trim()) {
			title = measure.qMeasure.qTitle.trim();
		} else if (measure.qMeasure.qTitle.qv && typeof measure.qMeasure.qTitle.qv === 'string' && measure.qMeasure.qTitle.qv.trim()) {
			title = measure.qMeasure.qTitle.qv.trim();
		}
	}
	
	const definition = safeExtractQDef(measure.qMeasure.qDef) || safeExtractQDef(measure.qMeasure);
	
	// For master measures, use the title as the name since they don't have field labels
	const nameArray = title ? [title] : [];

	return {
		id,
		tenantUser: cacheKey,
		appId,
		appName,
		spaceId: spaceId || '',
		sheetId: '',
		sheetName: '',
		sheetUrl: '',
		sheetApproved: false,
		sheetPublished: false,
		objectType: 'Master Measure',
		title: typeof title === 'string' ? title : '',
		name: nameArray,
		nameText: nameArray.join(' '),
		searchText: `${title} ${definition}`.trim(),
		definition,
		chartId: '',
		chartTitle: '',
		chartUrl: '',
		path
	};
}

/**
 * Creates a SearchIndexItem for a sheet dimension.
 */
export function createSheetDimensionIndexItem(
	cacheKey: string,
	appId: string,
	appName: string,
	spaceId: string,
	dim: any,
	idx: number,
	getSheetStatus: (sheetId: string) => { approved: boolean; published: boolean }
): SearchIndexItem {
	const path = `sheetDimensions[${idx}].qDef`;
	const id = `${cacheKey}:${appId}:${path}`;
	
	const sheetId = dim.sheetId || '';
	const sheetName = dim.sheetTitle || '';
	const sheetUrl = dim.sheetUrl || '';
	const chartId = dim.chartId || '';
	// Extract chart title - handle both string and object/expression formats
	const chartTitle = typeof dim.chartTitle === 'string' 
		? dim.chartTitle 
		: (extractChartTitle(dim) || '');
	const chartUrl = dim.chartUrl || '';
	const definition = safeExtractQDef(dim.qDef) || safeExtractQDef(dim);
	const labels = dim.qDef?.qFieldLabels || [];
	const title = dim.title || '';
	const sheetStatus = getSheetStatus(sheetId);
	const stringLabels = extractStringLabels(labels);

	return {
		id,
		tenantUser: cacheKey,
		appId,
		appName,
		spaceId: spaceId || '',
		sheetId,
		sheetName,
		sheetUrl,
		sheetApproved: sheetStatus.approved,
		sheetPublished: sheetStatus.published,
		objectType: 'Sheet Dimension',
		title: typeof title === 'string' ? title : '',
		name: stringLabels,
		nameText: stringLabels.join(' '),
		searchText: `${title} ${definition} ${sheetName} ${chartTitle} ${stringLabels.join(' ')}`.trim(),
		definition,
		chartId,
		chartTitle,
		chartUrl,
		path
	};
}

/**
 * Creates a SearchIndexItem for a sheet measure.
 */
export function createSheetMeasureIndexItem(
	cacheKey: string,
	appId: string,
	appName: string,
	spaceId: string,
	measure: any,
	idx: number,
	getSheetStatus: (sheetId: string) => { approved: boolean; published: boolean }
): SearchIndexItem {
	const path = `sheetMeasures[${idx}].qDef`;
	const id = `${cacheKey}:${appId}:${path}`;
	
	const sheetId = measure.sheetId || '';
	const sheetName = measure.sheetTitle || '';
	const sheetUrl = measure.sheetUrl || '';
	const chartId = measure.chartId || '';
	// Extract chart title - handle both string and object/expression formats
	const chartTitle = typeof measure.chartTitle === 'string' 
		? measure.chartTitle 
		: (extractChartTitle(measure) || '');
	const chartUrl = measure.chartUrl || '';
	const definition = safeExtractQDef(measure.qDef) || safeExtractQDef(measure);
	const title = measure.title || '';
	const sheetStatus = getSheetStatus(sheetId);

	return {
		id,
		tenantUser: cacheKey,
		appId,
		appName,
		spaceId: spaceId || '',
		sheetId,
		sheetName,
		sheetUrl,
		sheetApproved: sheetStatus.approved,
		sheetPublished: sheetStatus.published,
		objectType: 'Sheet Measure',
		title: typeof title === 'string' ? title : '',
		name: [],
		nameText: '',
		searchText: `${title} ${definition} ${sheetName} ${chartTitle}`.trim(),
		definition,
		chartId,
		chartTitle,
		chartUrl,
		path
	};
}

/**
 * Transforms search results to Excel export format.
 */
export function transformResultsForExcel(results: SearchResultItem[]): Array<Record<string, string>> {
	return results.map((result) => {
		const obj = result.object;
		const title = obj?.title || obj?.qAlias || (Array.isArray(obj?.qFieldLabels) && obj.qFieldLabels.length > 0 ? obj.qFieldLabels[0] : '') || 'N/A';
		const definition = obj?.qDef || 'N/A';
		const sheetName = result.sheet || result.sheetName || 'N/A';
		const sheetId = result.sheetId || result.context?.sheetId || null;
		const sheetUrl = result.sheetUrl || result.context?.sheetUrl || null;
		const chartId = result.chartId || obj?.qInfo?.qId || null;
		const chartTitle = result.chartTitle || result.context?.chartTitle || null;
		const chartUrl = result.chartUrl || result.context?.chartUrl || null;
		const name = result.name || [];

		return {
			Title: title,
			Definition: definition,
			App: result.app || 'N/A',
			Sheet: sheetName,
			Type: result.objectType || 'N/A',
			Name: name.length > 0 ? name.join(', ') : 'N/A',
			'Sheet ID': sheetId || 'N/A',
			'Sheet URL': sheetUrl || 'N/A',
			'Chart Title': chartTitle || 'N/A',
			'Chart URL': chartUrl || 'N/A',
			'Chart ID': chartId || 'N/A'
		};
	});
}

