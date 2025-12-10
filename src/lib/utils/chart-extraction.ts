/**
 * Utility functions for extracting charts from app structure data
 */

import { extractChartTitle } from './data-extraction';
import { getSheetUrl } from './url-utils';

export interface ChartInfo {
	chartId: string;
	chartType: string;
	chartTitle: string | null;
	chartUrl: string;
	sheetId: string;
	sheetTitle: string;
	appId: string;
	appName: string;
	spaceId?: string;
	spaceName?: string;
}

/**
 * Hard-coded list of deprecated chart types
 */
export const DEPRECATED_CHART_TYPES = [
	'qlik-button-for-navigation',
	'qlik-show-hide-container',
	'qlik-share-button',
	'qlik-tabbed-container',
	'qlik-heatmap-chart',
	'qlik-multi-kpi',
	'qlik-bullet-chart',
	'qlik-barplus-chart',
];

/**
 * Recursively finds all chart objects in a sheet structure
 */
function findChartsInObject(
	obj: any,
	sheetInfo: { sheetId: string; sheetTitle: string; sheetUrl: string },
	appInfo: { appId: string; appName: string; spaceId?: string; spaceName?: string }
): ChartInfo[] {
	const charts: ChartInfo[] = [];

	if (obj === null || obj === undefined) return charts;

	if (typeof obj === 'object') {
		// Check if this is an object with qInfo (any Qlik object)
		if (obj.qInfo) {
			const chartId = obj.qInfo.qId;
			const chartType = obj.qInfo.qType;
			const chartUrl = `${sheetInfo.sheetUrl}/chartId/${chartId}`;
			const chartTitle = extractChartTitle(obj);

			charts.push({
				chartId,
				chartType,
				chartTitle,
				chartUrl,
				sheetId: sheetInfo.sheetId,
				sheetTitle: sheetInfo.sheetTitle,
				appId: appInfo.appId,
				appName: appInfo.appName,
				spaceId: appInfo.spaceId,
				spaceName: appInfo.spaceName,
			});
		}

		// Recursively search in arrays and objects
		if (Array.isArray(obj)) {
			obj.forEach((item) => {
				charts.push(...findChartsInObject(item, sheetInfo, appInfo));
			});
		} else {
			Object.keys(obj).forEach((key) => {
				charts.push(...findChartsInObject(obj[key], sheetInfo, appInfo));
			});
		}
	}

	return charts;
}

/**
 * Extracts all charts from app structure data
 */
export function extractChartsFromAppStructure(
	structureData: any,
	appId: string,
	appName: string,
	tenantUrl: string,
	spaceId?: string,
	spaceName?: string
): ChartInfo[] {
	const charts: ChartInfo[] = [];
	const sheets = structureData.sheets || [];
	const seenChartIds = new Set<string>();

	sheets.forEach((sheet: any) => {
		const sheetId = sheet?.qProperty?.qInfo?.qId;
		const sheetTitle = sheet?.qProperty?.qMetaDef?.title;
		if (!sheetId || !sheetTitle) return;

		const sheetUrl = getSheetUrl(sheetId, appId, tenantUrl);
		const sheetInfo = {
			sheetId,
			sheetTitle,
			sheetUrl,
		};
		const appInfo = {
			appId,
			appName,
			spaceId,
			spaceName,
		};

		// Search in the full property tree
		const foundCharts = findChartsInObject(sheet, sheetInfo, appInfo);
		foundCharts.forEach((chart) => {
			if (!seenChartIds.has(chart.chartId)) {
				seenChartIds.add(chart.chartId);
				charts.push(chart);
			}
		});

		// Also check the cells structure which contains the actual visualizations
		if (sheet.qProperty?.cells) {
			const cellCharts = findChartsInObject(sheet.qProperty.cells, sheetInfo, appInfo);
			cellCharts.forEach((chart) => {
				if (!seenChartIds.has(chart.chartId)) {
					seenChartIds.add(chart.chartId);
					charts.push(chart);
				}
			});
		}

		// Check children if they exist
		if (sheet.qProperty?.children) {
			const childCharts = findChartsInObject(sheet.qProperty.children, sheetInfo, appInfo);
			childCharts.forEach((chart) => {
				if (!seenChartIds.has(chart.chartId)) {
					seenChartIds.add(chart.chartId);
					charts.push(chart);
				}
			});
		}
	});

	return charts;
}

/**
 * Filters charts by deprecated chart types
 */
export function filterDeprecatedCharts(charts: ChartInfo[]): ChartInfo[] {
	return charts.filter((chart) =>
		DEPRECATED_CHART_TYPES.some((deprecatedType) =>
			chart.chartType.toLowerCase().includes(deprecatedType.toLowerCase())
		)
	);
}

