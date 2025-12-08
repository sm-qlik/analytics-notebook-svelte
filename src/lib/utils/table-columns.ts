/**
 * Utility functions for extracting column values from search results.
 * Used for sorting and display across different table layouts.
 */

export interface SearchResult {
	path: string;
	object: any;
	objectType: string | null;
	context: any;
	file?: string;
	app?: string;
	appId?: string;
	sheet?: string | null;
	sheetName?: string | null;
	sheetId?: string | null;
	sheetUrl?: string | null;
	chartId?: string | null;
	chartTitle?: string | null;
	chartUrl?: string | null;
	labels?: string[];
}

export type SortableColumn = 'labels' | 'definition' | 'app' | 'sheet' | 'type' | 'chartTitle' | null;

/**
 * Get the displayed value for a column from a search result.
 * Simple rule: strings are returned as strings, everything else (null/undefined/objects) is treated as empty string.
 * This ensures consistent behavior across all columns and table layouts.
 */
export function getColumnValue(result: SearchResult, column: SortableColumn): string {
	if (!column) return '';
	
	let value: any;
	
	switch (column) {
		case 'labels': {
			const labels = result.labels || [];
			value = labels.length > 0 ? labels.join(', ') : 'N/A';
			break;
		}
		
		case 'definition': {
			const obj = result.object;
			if (!obj) {
				value = 'N/A';
				break;
			}
			if (typeof obj.qDef === 'string' && obj.qDef.trim()) {
				value = obj.qDef.trim();
			} else if (typeof obj.qGrouping === 'string' && obj.qGrouping.trim()) {
				value = obj.qGrouping.trim();
			} else if (typeof obj.qLabelExpression === 'string' && obj.qLabelExpression.trim()) {
				value = obj.qLabelExpression.trim();
			} else {
				value = 'N/A';
			}
			break;
		}
		
		case 'app': {
			const appName = typeof result.app === 'string' ? result.app : '';
			const appId = typeof result.appId === 'string' ? result.appId : '';
			value = appId ? `${appName} ${appId}` : appName;
			break;
		}
		
		case 'sheet': {
			const sheetName = typeof result.sheet === 'string' ? result.sheet : (typeof result.sheetName === 'string' ? result.sheetName : 'N/A');
			const sheetId = typeof result.sheetId === 'string' ? result.sheetId : (typeof result.context?.sheetId === 'string' ? result.context.sheetId : null);
			value = sheetId ? `${sheetName} ${sheetId}` : sheetName;
			break;
		}
		
		case 'type':
			value = result.objectType;
			break;
		
		case 'chartTitle': {
			const chartTitle = typeof result.chartTitle === 'string' ? result.chartTitle : (typeof result.context?.chartTitle === 'string' ? result.context.chartTitle : 'N/A');
			const chartId = typeof result.chartId === 'string' ? result.chartId : (typeof result.context?.chartId === 'string' ? result.context.chartId : null);
			value = chartId && chartTitle !== 'N/A' ? `${chartTitle} ${chartId}` : chartTitle;
			break;
		}
		
		default:
			return '';
	}
	
	// Simple rule: strings are strings, everything else is empty string
	return typeof value === 'string' ? value.toLowerCase() : '';
}

