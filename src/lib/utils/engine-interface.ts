/**
 * EngineInterface - Qlik Engine API Integration
 * Handles all interactions with the Qlik Engine API for fetching app structure data
 * Based on analytics-notebook implementation
 */

// JSONPath implementation (simplified version)
function jsonPath(obj: any, path: string, callback?: (value: any) => void): any[] {
	const results: any[] = [];
	
	function traverse(current: any, currentPath: string[]): void {
		if (current === null || current === undefined) return;
		
		if (currentPath.length === 0) {
			if (callback) {
				callback(current);
			}
			results.push(current);
			return;
		}
		
		const [head, ...tail] = currentPath;
		
		if (head === '*') {
			if (Array.isArray(current)) {
				current.forEach((item, index) => {
					traverse(item, tail);
				});
			} else if (typeof current === 'object') {
				Object.values(current).forEach(value => {
					traverse(value, tail);
				});
			}
		} else if (head.startsWith('$..')) {
			// Deep search
			const searchKey = head.replace('$..', '');
			if (typeof current === 'object' && current !== null) {
				if (Array.isArray(current)) {
					current.forEach(item => {
						traverse(item, currentPath);
						if (item && typeof item === 'object' && searchKey in item) {
							traverse(item[searchKey], tail);
						}
					});
				} else {
					Object.keys(current).forEach(key => {
						traverse(current[key], currentPath);
						if (key === searchKey) {
							traverse(current[key], tail);
						}
					});
				}
			}
		} else if (head.startsWith('$.')) {
			const key = head.replace('$.', '');
			if (typeof current === 'object' && current !== null && key in current) {
				traverse(current[key], tail);
			}
		} else {
			if (typeof current === 'object' && current !== null && head in current) {
				traverse(current[head], tail);
			}
		}
	}
	
	// Simple path parser for our use case
	if (path.includes('$..*[?(@ && @.qInfo && @.qHyperCubeDef)]')) {
		// Find all objects with qInfo and qHyperCubeDef
		function findCharts(obj: any): void {
			if (obj === null || obj === undefined) return;
			
			if (typeof obj === 'object') {
				if (obj.qInfo && obj.qHyperCubeDef) {
					if (callback) {
						callback(obj);
					}
					results.push(obj);
				}
				
				if (Array.isArray(obj)) {
					obj.forEach(item => findCharts(item));
				} else {
					Object.values(obj).forEach(value => findCharts(value));
				}
			}
		}
		findCharts(path.startsWith('$') ? (path.includes('$..') ? undefined : undefined) : undefined);
		// For now, we'll use a simpler approach
		return results;
	}
	
	const pathParts = path.split('.').filter(p => p);
	traverse(obj, pathParts);
	return results;
}

export interface AppStructureData {
	appLayout: any;
	masterDimensions: any[];
	masterMeasures: any[];
	sheets: any[];
	sheetDimensions: any[];
	sheetMeasures: any[];
}

export class EngineInterface {
	/**
	 * Fetch app structure including layout, dimensions, measures, and sheets
	 */
	static async fetchAppStructureData(app: any, tenantUrl: string, appId: string): Promise<AppStructureData> {
		// Get app layout with metadata
		const appLayout = await app.getAppLayout();

		// Get master measures
		const measureListProps = {
			qInfo: {
				qId: 'MeasureList',
				qType: 'MeasureList',
			},
			qMeasureListDef: {
				qType: 'measure',
				qData: {
					title: '/qMetaDef/title',
					tags: '/qMetaDef/tags',
					labelExpression: '/qMeasure/qLabelExpression',
				},
			},
		};

		const measurelist = await app.createSessionObject(measureListProps);
		const measures = await measurelist.getLayout();
		const masterMeasures = await Promise.all(
			measures.qMeasureList.qItems.map(async (item: any) => {
				const measure = await app.getMeasure(item.qInfo.qId);
				const props = await measure.getProperties();
				return props;
			})
		);

		// Get master dimensions
		const dimensionListProps = {
			qInfo: {
				qId: 'DimensionList',
				qType: 'DimensionList',
			},
			qDimensionListDef: {
				qType: 'dimension',
				qData: {
					title: '/qMetaDef/title',
					tags: '/qMetaDef/tags',
					grouping: '/qDim/qGrouping',
					info: '/qDimInfos',
					labelExpression: '/qDim/qLabelExpression',
				},
			},
		};

		const dimensionList = await app.createSessionObject(dimensionListProps);
		const dimensions = await dimensionList.getLayout();
		const masterDimensions = await Promise.all(
			dimensions.qDimensionList.qItems.map(async (item: any) => {
				const dimension = await app.getDimension(item.qInfo.qId);
				const props = await dimension.getProperties();
				return props;
			})
		);

		// Get sheets
		const sheetListProps = {
			qInfo: {
				qId: 'SheetList',
				qType: 'SheetList',
			},
			qAppObjectListDef: {
				qType: 'sheet',
				qData: {
					title: '/qMetaDef/title',
					labelExpression: '/labelExpression',
					showCondition: '/showCondition',
					description: '/qMetaDef/description',
					descriptionExpression: '/descriptionExpression',
					creationDate: '/creationDate',
					thumbnail: '/thumbnail',
					cells: '/cells',
					rank: '/rank',
					columns: '/columns',
					rows: '/rows',
					groupId: '/groupId',
				},
			},
		};

		const sheetList = await app.createSessionObject(sheetListProps);
		const sheetListLayout = await sheetList.getLayout();
		const sheets: any[] = [];
		const sheetDimensions: any[] = [];
		const sheetMeasures: any[] = [];

		await Promise.all(
			sheetListLayout.qAppObjectList.qItems.map(async (item: any) => {
				const sheet = await app.getObject(item.qInfo.qId);
				const sheetProps = await sheet.getFullPropertyTree();
				const sheetLayout = await sheet.getLayout();
				const sheetId = sheetProps.qProperty.qInfo.qId;
				sheetProps.published = !!sheetLayout?.qMeta?.published;
				const sheetUrl = `https://${tenantUrl}/sense/app/${appId}/sheet/${sheetId}`;
				const sheetInfo = {
					sheetId,
					sheetTitle: sheetProps.qProperty.qMetaDef.title,
					sheetUrl,
				};
				sheetProps.sheetUrl = sheetUrl;

				sheets.push(sheetProps);

				// Find all charts with qInfo and qHyperCubeDef
				function findCharts(obj: any, path = ''): void {
					if (obj === null || obj === undefined) return;

					if (typeof obj === 'object') {
						if (obj.qInfo && obj.qHyperCubeDef) {
							const chartId = obj.qInfo.qId;
							const chartUrl = `${sheetUrl}/chartId/${chartId}`;
							obj.chartUrl = chartUrl;
							const chartInfo = {
								chartId,
								chartType: obj.qInfo.qType,
								chartTitle: obj.title,
								chartUrl,
							};

							// Extract measures
							if (obj.qHyperCubeDef.qMeasures && Array.isArray(obj.qHyperCubeDef.qMeasures)) {
								obj.qHyperCubeDef.qMeasures.forEach((m: any) => {
									if (m.qLibraryId) {
										sheetMeasures.push({
											...sheetInfo,
											...chartInfo,
											qLibraryId: m.qLibraryId,
										});
									} else {
										sheetMeasures.push({
											...sheetInfo,
											...chartInfo,
											...m,
										});
									}
								});
							}

							// Extract dimensions
							if (obj.qHyperCubeDef.qDimensions && Array.isArray(obj.qHyperCubeDef.qDimensions)) {
								obj.qHyperCubeDef.qDimensions.forEach((dim: any) => {
									if (dim.qLibraryId) {
										sheetDimensions.push({
											...sheetInfo,
											...chartInfo,
											qLibraryId: dim.qLibraryId,
										});
									} else {
										sheetDimensions.push({
											...sheetInfo,
											...chartInfo,
											...dim,
										});
									}
								});
							}
						}

						if (Array.isArray(obj)) {
							obj.forEach((item, index) => findCharts(item, `${path}[${index}]`));
						} else {
							Object.keys(obj).forEach((key) => {
								findCharts(obj[key], path ? `${path}.${key}` : key);
							});
						}
					}
				}

				findCharts(sheetProps);
			})
		);

		return {
			appLayout,
			masterDimensions,
			masterMeasures,
			sheets,
			sheetDimensions,
			sheetMeasures,
		};
	}
}

