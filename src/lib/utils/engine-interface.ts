/**
 * EngineInterface - Qlik Engine API Integration
 * Handles all interactions with the Qlik Engine API for fetching app structure data
 * Based on analytics-notebook implementation
 */

import { extractChartTitle } from './data-extraction';
import { getSheetUrl } from './url-utils';

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

		// Define props for all list objects
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

		// Create all session objects in parallel
		const [measurelist, dimensionList, sheetList] = await Promise.all([
			app.createSessionObject(measureListProps),
			app.createSessionObject(dimensionListProps),
			app.createSessionObject(sheetListProps)
		]);

		// Get all layouts in parallel
		const [measures, dimensions, sheetListLayout] = await Promise.all([
			measurelist.getLayout(),
			dimensionList.getLayout(),
			sheetList.getLayout()
		]);

		// Fetch all master measures and dimensions in parallel
		const [masterMeasures, masterDimensions] = await Promise.all([
			Promise.all(
				measures.qMeasureList.qItems.map(async (item: any) => {
					const measure = await app.getMeasure(item.qInfo.qId);
					const props = await measure.getProperties();
					return props;
				})
			),
			Promise.all(
				dimensions.qDimensionList.qItems.map(async (item: any) => {
					const dimension = await app.getDimension(item.qInfo.qId);
					const props = await dimension.getProperties();
					return props;
				})
			)
		]);

		const sheets: any[] = [];
		const sheetDimensions: any[] = [];
		const sheetMeasures: any[] = [];

		await Promise.all(
			sheetListLayout.qAppObjectList.qItems.map(async (item: any) => {
				const sheet = await app.getObject(item.qInfo.qId);
				const sheetProps = await sheet.getFullPropertyTree();
				const sheetLayout = await sheet.getLayout();
				const sheetId = sheetProps.qProperty.qInfo.qId;
				const sheetTitle = sheetProps.qProperty.qMetaDef.title;
				sheetProps.published = !!sheetLayout?.qMeta?.published;
				sheetProps.approved = !!sheetLayout?.qMeta?.approved;
				const sheetUrl = getSheetUrl(sheetId, appId, tenantUrl);
				const sheetInfo = {
					sheetId,
					sheetTitle,
					sheetUrl,
				};
				sheetProps.sheetUrl = sheetUrl;

				sheets.push(sheetProps);

				// Recursively find all visualization objects in the sheet
				function findObjects(obj: any, path = ''): void {
					if (obj === null || obj === undefined) return;

					if (typeof obj === 'object') {
						// Check if this is an object with qInfo (any Qlik object)
						if (obj.qInfo) {
							const chartId = obj.qInfo.qId;
							const chartUrl = `${sheetUrl}/chartId/${chartId}`;
							const chartInfo = {
								chartId,
								chartType: obj.qInfo.qType,
								chartTitle: extractChartTitle(obj),
								chartUrl,
							};

							// Extract from qHyperCubeDef (standard charts)
							if (obj.qHyperCubeDef) {
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

							// Extract from qListObjectDef (listboxes, filter panes)
							if (obj.qListObjectDef) {
								if (obj.qListObjectDef.qDef) {
									// Single dimension in listbox
									if (obj.qListObjectDef.qDef.qLibraryId) {
										sheetDimensions.push({
											...sheetInfo,
											...chartInfo,
											qLibraryId: obj.qListObjectDef.qDef.qLibraryId,
										});
									} else if (obj.qListObjectDef.qDef.qFieldDefs || obj.qListObjectDef.qDef.qFieldLabels) {
										sheetDimensions.push({
											...sheetInfo,
											...chartInfo,
											qDef: obj.qListObjectDef.qDef.qFieldDefs || obj.qListObjectDef.qDef.qFieldLabels,
											qFieldDefs: obj.qListObjectDef.qDef.qFieldDefs,
											qFieldLabels: obj.qListObjectDef.qDef.qFieldLabels,
										});
									}
								}
							}

							// Extract from qDef directly (some object types)
							if (obj.qDef && !obj.qHyperCubeDef && !obj.qListObjectDef) {
								if (obj.qDef.qLibraryId) {
									// Could be a dimension or measure reference
									sheetDimensions.push({
										...sheetInfo,
										...chartInfo,
										qLibraryId: obj.qDef.qLibraryId,
									});
								} else if (typeof obj.qDef === 'string' || obj.qDef.qFieldDefs || obj.qDef.qFieldLabels) {
									sheetDimensions.push({
										...sheetInfo,
										...chartInfo,
										qDef: typeof obj.qDef === 'string' ? obj.qDef : (obj.qDef.qFieldDefs || obj.qDef.qFieldLabels),
										qFieldDefs: obj.qDef.qFieldDefs,
										qFieldLabels: obj.qDef.qFieldLabels,
									});
								}
							}

							// Extract from qMeasureListDef (measure objects)
							if (obj.qMeasureListDef) {
								if (obj.qMeasureListDef.qItems && Array.isArray(obj.qMeasureListDef.qItems)) {
									obj.qMeasureListDef.qItems.forEach((m: any) => {
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
							}

							// Extract from qDimensionListDef (dimension objects)
							if (obj.qDimensionListDef) {
								if (obj.qDimensionListDef.qItems && Array.isArray(obj.qDimensionListDef.qItems)) {
									obj.qDimensionListDef.qItems.forEach((dim: any) => {
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
						}

						if (Array.isArray(obj)) {
							obj.forEach((item, index) => findObjects(item, `${path}[${index}]`));
						} else {
							Object.keys(obj).forEach((key) => {
								findObjects(obj[key], path ? `${path}.${key}` : key);
							});
						}
					}
				}

				// First, try to find objects in the full property tree
				findObjects(sheetProps);

				// Also check the cells structure which contains the actual visualizations
				if (sheetProps.qProperty?.cells) {
					findObjects(sheetProps.qProperty.cells);
				}

				// Check children if they exist
				if (sheetProps.qProperty?.children) {
					findObjects(sheetProps.qProperty.children);
				}

				// Also iterate through cells and get each object's layout for more complete data
				if (sheetLayout?.qLayout?.cells && Array.isArray(sheetLayout.qLayout.cells)) {
					await Promise.all(
						sheetLayout.qLayout.cells.map(async (cell: any) => {
							if (cell.name && cell.name !== '') {
								try {
									const cellObject = await app.getObject(cell.name);
									const cellLayout = await cellObject.getLayout();
									findObjects(cellLayout);
								} catch {
									// Some objects might not be accessible, skip them
								}
							}
						})
					);
				}

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

