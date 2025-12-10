/**
 * Utility functions for extracting data from Qlik structure objects.
 * These functions are pure and can be easily unit tested.
 */

/**
 * Extracts searchable text from an object by flattening specific fields.
 * @param obj - The object to extract searchable fields from
 * @returns A string containing all searchable text
 */
export function extractSearchableFields(obj: any): string {
	if (obj === null || obj === undefined) return '';
	
	const searchableFields: string[] = [];
	const fieldsToSearch = ['qFieldDefs', 'qFieldLabels', 'qLabelExpression', 'qAlias', 'title', 'qDef', 'qTitle'];
	
	function flattenValue(value: any): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (Array.isArray(value)) {
			return value.map(item => flattenValue(item)).filter(Boolean).join(' ');
		}
		if (typeof value === 'object') {
			return Object.entries(value)
				.map(([key, val]) => flattenValue(val))
				.filter(Boolean)
				.join(' ');
		}
		return '';
	}
	
	fieldsToSearch.forEach(field => {
		if (obj[field] !== undefined && obj[field] !== null) {
			const value = flattenValue(obj[field]);
			if (value) {
				searchableFields.push(value);
			}
		}
	});
	
	return searchableFields.join(' ');
}

/**
 * Helper function to extract string from qTitle (can be string or object with qv property).
 */
function extractQTitle(qTitle: any): string | null {
	if (!qTitle) return null;
	if (typeof qTitle === 'string' && qTitle.trim()) {
		return qTitle.trim();
	}
	if (typeof qTitle === 'object' && qTitle.qv && typeof qTitle.qv === 'string' && qTitle.qv.trim()) {
		return qTitle.qv.trim();
	}
	return null;
}

/**
 * Extracts sheet metadata (approved and published status) from an array of sheets.
 * @param sheets - Array of sheet objects from structureData
 * @returns Map of sheetId to metadata object
 */
export function extractSheetMetadata(sheets: any[]): Map<string, { approved: boolean; published: boolean }> {
	const metadata = new Map<string, { approved: boolean; published: boolean }>();
	sheets.forEach((sheet: any) => {
		const sheetId = sheet?.qProperty?.qInfo?.qId || '';
		if (sheetId) {
			const approved = !!sheet.approved;
			const published = !!sheet.published;
			metadata.set(sheetId, { approved, published });
		}
	});
	return metadata;
}

/**
 * Extracts sheet objects from structureData for a given app.
 * @param sheets - Array of sheet objects from structureData
 * @param appName - Name of the app
 * @param appId - ID of the app
 * @returns Array of sheet objects with name, app, appId, sheetId, approved, and published
 */
export function extractSheetObjects(
	sheets: any[],
	appName: string,
	appId: string
): Array<{ name: string; app: string; appId: string; sheetId: string; approved?: boolean; published?: boolean }> {
	const newSheets: Array<{ name: string; app: string; appId: string; sheetId: string; approved?: boolean; published?: boolean }> = [];
	sheets.forEach((sheet: any) => {
		const sheetTitle = sheet?.qProperty?.qMetaDef?.title;
		const sheetId = sheet?.qProperty?.qInfo?.qId || '';
		if (sheetTitle && sheetId) {
			const approved = !!sheet.approved;
			const published = !!sheet.published;
			newSheets.push({
				name: sheetTitle,
				app: appName,
				appId: appId,
				sheetId: sheetId,
				approved,
				published
			});
		}
	});
	return newSheets;
}

/**
 * Safely extracts a qDef string from a value.
 * Handles strings, objects with qv/qDef properties, and arrays.
 * @param value - The value to extract qDef from
 * @returns The extracted qDef string, or empty string if not found
 */
export function safeExtractQDef(value: any): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value.trim();
	if (typeof value === 'object') {
		if (value.qv && typeof value.qv === 'string') return value.qv.trim();
		if (value.qDef && typeof value.qDef === 'string') return value.qDef.trim();
		if (Array.isArray(value.qFieldDefs) && value.qFieldDefs.length > 0) {
			return value.qFieldDefs.join(' ');
		}
	}
	return '';
}

/**
 * Extracts title from an object, checking multiple possible locations.
 * @param obj - The object to extract title from
 * @param fallback - Optional fallback value if no title is found
 * @returns The extracted title string
 */
export function extractTitle(obj: any, fallback: string = ''): string {
	if (!obj) return fallback;
	
	// Check qMetaDef.title first (common for master objects)
	if (obj.qMetaDef?.title && typeof obj.qMetaDef.title === 'string') {
		return obj.qMetaDef.title.trim();
	}
	
	// Check qLabel
	if (obj.qLabel) {
		if (typeof obj.qLabel === 'string' && obj.qLabel.trim()) {
			return obj.qLabel.trim();
		}
		if (typeof obj.qLabel === 'object' && obj.qLabel.qv && typeof obj.qLabel.qv === 'string') {
			return obj.qLabel.qv.trim();
		}
	}
	
	// Check title directly
	if (obj.title && typeof obj.title === 'string') {
		return obj.title.trim();
	}
	
	// Check qTitle
	const qTitle = extractQTitle(obj.qTitle);
	if (qTitle) {
		return qTitle;
	}
	
	return fallback;
}

/**
 * Extracts a clean array of string labels from a labels value.
 * Filters out non-string values and empty strings.
 * @param labels - The labels value (can be array, string, or object)
 * @returns Array of string labels
 */
export function extractStringLabels(labels: any): string[] {
	if (!labels) return [];
	if (Array.isArray(labels)) {
		return labels.filter((l: any) => typeof l === 'string' && l.trim()).map((l: string) => l.trim());
	}
	if (typeof labels === 'string' && labels.trim()) {
		return [labels.trim()];
	}
	return [];
}

/**
 * Extracts chart title from a chart object, handling both direct titles and expression definitions.
 * Supports:
 * - obj.title (string)
 * - obj.qMeta?.title (string)
 * - obj.qStringExpression?.qExpr (expression - returned as-is)
 * - obj.qMetaDef?.title (string)
 * - obj.qExpr (expression - returned as-is)
 * 
 * Note: Expressions are returned as-is without parsing, since they may be calculations.
 * @param obj - The chart object to extract title from
 * @returns The extracted chart title string, or null if not found
 */
export function extractChartTitle(obj: any): string | null {
	if (!obj) return null;
	
	// Try direct title first
	if (obj.title && typeof obj.title === 'string' && obj.title.trim()) {
		return obj.title.trim();
	}
	
	// Try qMeta.title
	if (obj.qMeta?.title && typeof obj.qMeta.title === 'string' && obj.qMeta.title.trim()) {
		return obj.qMeta.title.trim();
	}
	
	// Try qMetaDef.title
	if (obj.qMetaDef?.title && typeof obj.qMetaDef.title === 'string' && obj.qMetaDef.title.trim()) {
		return obj.qMetaDef.title.trim();
	}
	
	// Try qStringExpression.qExpr (expression format - return as-is)
	if (obj.qStringExpression?.qExpr) {
		if (typeof obj.qStringExpression.qExpr === 'string' && obj.qStringExpression.qExpr.trim()) {
			return obj.qStringExpression.qExpr.trim();
		}
	}
	
	// Try other expression formats (return as-is)
	if (obj.qExpr && typeof obj.qExpr === 'string' && obj.qExpr.trim()) {
		return obj.qExpr.trim();
	}
	
	return null;
}

