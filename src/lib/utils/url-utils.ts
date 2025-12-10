/**
 * Shared utility functions for building Qlik Cloud URLs
 */

/**
 * Normalizes a tenant URL by removing protocol if present
 */
export function normalizeTenantUrl(tenantUrl: string): string {
	return tenantUrl.replace(/^https?:\/\//, '');
}

/**
 * Builds a URL to a Qlik Sense app
 */
export function getAppUrl(appId: string, tenantUrl: string): string {
	const cleanTenantUrl = normalizeTenantUrl(tenantUrl);
	return `https://${cleanTenantUrl}/sense/app/${appId}`;
}

/**
 * Builds a URL to a Qlik Sense sheet
 */
export function getSheetUrl(sheetId: string, appId: string, tenantUrl: string): string {
	const cleanTenantUrl = normalizeTenantUrl(tenantUrl);
	return `https://${cleanTenantUrl}/sense/app/${appId}/sheet/${sheetId}`;
}

/**
 * Builds a URL to a Qlik Sense chart
 */
export function getChartUrl(sheetId: string, chartId: string, appId: string, tenantUrl: string): string {
	const cleanTenantUrl = normalizeTenantUrl(tenantUrl);
	return `https://${cleanTenantUrl}/sense/app/${appId}/sheet/${sheetId}/chartId/${chartId}`;
}

/**
 * Builds a URL to a Qlik Sense space
 */
export function getSpaceUrl(spaceId: string, tenantUrl: string): string {
	const cleanTenantUrl = normalizeTenantUrl(tenantUrl);
	return `https://${cleanTenantUrl}/spaces/${spaceId}`;
}

