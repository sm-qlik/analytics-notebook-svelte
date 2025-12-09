export type ExtractContext = {
  inMasterDimensions?: boolean;
  inMasterMeasures?: boolean;
  inSheetDimensions?: boolean;
  inSheetMeasures?: boolean;
  inQdim?: boolean;
  inQmeasure?: boolean;
  objectType?: string | null;
  sheetName?: string | null;
  sheetId?: string | null;
  sheetUrl?: string | null;
  chartTitle?: string | null;
  chartUrl?: string | null;
  appName?: string;
  appId?: string;
  chartName?: string | null;
};

export type Helpers = {
  getSheetNameFromId: (sheetId: string | null) => string | null;
  extractLabels: (obj: any, parentObj: any, context: any, qDefString: string | null) => string[];
  extractSearchableFields: (obj: any) => string;
  processedObjects: Map<string, boolean>;
  indexPush: (item: {
    path: string;
    object: any;
    objectType: string | null;
    context: any;
    file: string;
    app: string;
    appId: string;
    sheet: string | null;
    sheetName: string | null;
    sheetId: string | null;
    sheetUrl: string | null;
    chartId: string | null;
    chartTitle: string | null;
    chartUrl: string | null;
    searchableText: string;
    labels: string[];
    title: string;
  }) => void;
};

export function extractObjects(
  obj: any,
  path = '',
  context: ExtractContext = {},
  appId: string,
  appName: string,
  parentObj: any,
  helpers: Helpers
) {
  if (obj === null || obj === undefined) return;

  const { getSheetNameFromId, extractLabels, extractSearchableFields, processedObjects, indexPush } = helpers;

  let inMasterDimensions = context.inMasterDimensions || false;
  let inMasterMeasures = context.inMasterMeasures || false;
  let inSheetDimensions = context.inSheetDimensions || false;
  let inSheetMeasures = context.inSheetMeasures || false;

  if (path === 'masterDimensions' || path.includes('masterDimensions[')) {
    inMasterDimensions = true;
  }
  if (path === 'masterMeasures' || path.includes('masterMeasures[')) {
    inMasterMeasures = true;
  }
  if (path === 'sheetDimensions' || path.includes('sheetDimensions[')) {
    inSheetDimensions = true;
  }
  if (path === 'sheetMeasures' || path.includes('sheetMeasures[')) {
    inSheetMeasures = true;
  }

  let inQdim = context.inQdim || false;
  let inQmeasure = context.inQmeasure || false;

  if (path.endsWith('.qDim') || path.includes('.qDim.')) {
    inQdim = true;
  }
  if (path.endsWith('.qMeasure') || path.includes('.qMeasure.')) {
    inQmeasure = true;
  }
  if (path.endsWith('.qDef') || path.includes('.qDef.')) {
    if (inSheetDimensions || path.includes('sheetDimensions[')) {
      inQdim = true;
    }
    if (inSheetMeasures || path.includes('sheetMeasures[')) {
      inQmeasure = true;
    }
  }

  let objectType: string | null = context.objectType || null;
  if (inQdim) {
    if (inMasterDimensions) {
      objectType = 'Master Dimension';
    } else if (inSheetDimensions) {
      objectType = 'Sheet Dimension';
    } else if (path.includes('masterDimensions')) {
      objectType = 'Master Dimension';
    } else if (path.includes('sheetDimensions')) {
      objectType = 'Sheet Dimension';
    } else {
      objectType = 'Sheet Dimension';
    }
  } else if (inQmeasure) {
    if (inMasterMeasures) {
      objectType = 'Master Measure';
    } else if (inSheetMeasures) {
      objectType = 'Sheet Measure';
    } else if (path.includes('masterMeasures')) {
      objectType = 'Master Measure';
    } else if (path.includes('sheetMeasures')) {
      objectType = 'Sheet Measure';
    } else {
      objectType = 'Sheet Measure';
    }
  }

  let sheetId = context.sheetId || null;
  let sheetName = context.sheetName || null;

  if ((inSheetDimensions || inSheetMeasures) && typeof obj === 'object' && obj !== null && 'sheetId' in obj) {
    sheetId = (obj as any).sheetId;
    if (sheetId) {
      sheetName = getSheetNameFromId(sheetId);
    }
  }

  const newContext = {
    ...context,
    inQdim,
    inQmeasure,
    inMasterDimensions,
    inMasterMeasures,
    inSheetDimensions: inSheetDimensions || context.inSheetDimensions || false,
    inSheetMeasures: inSheetMeasures || context.inSheetMeasures || false,
    objectType: objectType || context.objectType || null,
    sheetName: sheetName || context.sheetName || null,
    sheetId: sheetId || context.sheetId || null
  };

  const isQdimObject = (path.endsWith('.qDim') || (path.endsWith('.qDef') && inSheetDimensions));
  const isQmeasureObject = (path.endsWith('.qMeasure') || (path.endsWith('.qDef') && inSheetMeasures));

  // For qDef that are strings, we still want to process them but use parentObj for label extraction
  const shouldProcessAsObject = (isQdimObject || isQmeasureObject) && typeof obj === 'object';
  const shouldProcessAsString = (isQdimObject || isQmeasureObject) && typeof obj === 'string';

  if (shouldProcessAsObject || shouldProcessAsString) {
    // Include appId in the key since object paths are only unique within an app.
    // If the same path exists in different apps, using only the path as a key would cause
    // collisions and incorrect deduplication, leading to data from one app overwriting or
    // being confused with data from another. Namespacing with appId ensures correctness
    // by keeping objects from different apps distinct, even if their paths are identical.
    const objectKey = `${appId}:${path}`;
    if (!processedObjects.has(objectKey)) {
      processedObjects.set(objectKey, true);

      // For string qDef, we need to look at parentObj for labels; for object qDim/qMeasure, use obj
      // Pass the qDef string explicitly so it can be filtered out from labels
      const labels = shouldProcessAsString
        ? extractLabels(null, parentObj, newContext, obj as string)
        : extractLabels(obj, parentObj, newContext, null);

      let searchableText = extractSearchableFields(obj);
      // Add labels to searchable text so they can be searched
      if (labels.length > 0) {
        searchableText += ' ' + labels.join(' ');
      }
      // Add sheet and chart names/titles to searchable text
      if (newContext.sheetName && typeof newContext.sheetName === 'string') {
        searchableText += ' ' + newContext.sheetName.trim();
      }
      if ((newContext as any).sheetTitle && typeof (newContext as any).sheetTitle === 'string') {
        searchableText += ' ' + ((newContext as any).sheetTitle as string).trim();
      }
      if ((newContext as any).chartTitle && typeof (newContext as any).chartTitle === 'string') {
        searchableText += ' ' + ((newContext as any).chartTitle as string).trim();
      }
      // Also check for chartName if it exists
      if ((newContext as any).chartName && typeof (newContext as any).chartName === 'string') {
        searchableText += ' ' + ((newContext as any).chartName as string).trim();
      }

      // Extract title from object
      const title = (obj?.title || obj?.qAlias || (Array.isArray(obj?.qFieldLabels) && obj.qFieldLabels.length > 0 ? obj.qFieldLabels[0] : '') || '') as string;

      let chartId: string | null = null;
      if (parentObj && typeof parentObj === 'object' && parentObj.qInfo?.qId) {
        chartId = parentObj.qInfo.qId;
      } else if (typeof obj === 'object' && obj !== null && (obj as any).qInfo?.qId) {
        chartId = (obj as any).qInfo.qId;
      }

      // Helper function to safely extract string from qDef value
      function safeExtractQDefString(value: any): string | null {
        if (value === null || value === undefined) return null;
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'object') {
          // Try common Qlik object properties
          if (value.qv && typeof value.qv === 'string' && value.qv.trim()) return value.qv.trim();
          if (value.qDef && typeof value.qDef === 'string' && value.qDef.trim()) return value.qDef.trim();
          if (value.qDef && typeof value.qDef === 'object' && value.qDef.qv && typeof value.qDef.qv === 'string') {
            return value.qDef.qv.trim();
          }
          // Avoid [object Object] - return null if we can't extract a meaningful string
          return null;
        }
        // For numbers, booleans, etc., convert to string
        const str = String(value).trim();
        return str || null;
      }

      // Ensure qDef is accessible in the stored object
      let objectToStore = obj;
      if (typeof obj === 'string') {
        // String qDef - wrap it
        objectToStore = { qDef: obj };
      } else if (typeof obj === 'object' && obj !== null) {
        // Object qDim/qMeasure - ensure qDef is accessible
        if (!(obj as any).qDef) {
          // Try to get qDef from parentObj
          let qDefStr: string | null = null;
          if (parentObj?.qDef) {
            qDefStr = safeExtractQDefString(parentObj.qDef);
          } else if (parentObj?.qDim?.qDef) {
            qDefStr = safeExtractQDefString(parentObj.qDim.qDef);
          } else if (parentObj?.qMeasure?.qDef) {
            qDefStr = safeExtractQDefString(parentObj.qMeasure.qDef);
          }
          if(!qDefStr && obj.qFieldDefs) {
            if(obj.qFieldDefs.length > 0) {
              qDefStr =  obj.qFieldDefs.join(' ');
            }
          }          
          // For qMeasure objects, check qLabelExpression as fallback
          if (!qDefStr && (obj as any).qLabelExpression) {
            qDefStr = safeExtractQDefString((obj as any).qLabelExpression);
          }
          if (qDefStr) {
            objectToStore = { ...(obj as any), qDef: qDefStr };
          }
        } else {
          // obj.qDef exists - ensure it's a string
          const qDefStr = safeExtractQDefString((obj as any).qDef);
          if (qDefStr) {
            objectToStore = { ...(obj as any), qDef: qDefStr };
          } else {
            // If we can't extract a string, set to null to avoid [object Object]
            objectToStore = { ...(obj as any), qDef: null };
          }
        }
      }

      indexPush({
        path,
        object: objectToStore,
        objectType: newContext.objectType || null,
        context: newContext,
        file: appId,
        app: appName,
        appId: appId,
        sheet: sheetName || null,
        sheetName: sheetName || null,
        sheetId: (newContext as any).sheetId || null,
        sheetUrl: (newContext as any).sheetUrl || null,
        chartId,
        chartTitle: (newContext as any).chartTitle || null,
        chartUrl: (newContext as any).chartUrl || null,
        searchableText,
        labels,
        title,
      });
    }
    return;
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      let itemContext: any = newContext;
      if (path === 'sheets' && item?.qProperty?.qMetaDef?.title) {
        itemContext = {
          ...newContext,
          sheetName: item.qProperty.qMetaDef.title,
          sheetId: item.qProperty.qInfo?.qId,
        };
      } else if ((path === 'sheetDimensions' || path === 'sheetMeasures') && item?.sheetId) {
        const itemSheetName = getSheetNameFromId(item.sheetId) || null;
        itemContext = {
          ...newContext,
          sheetName: itemSheetName,
          sheetId: item.sheetId,
          inSheetDimensions: path === 'sheetDimensions',
          inSheetMeasures: path === 'sheetMeasures',
        };
      }
      extractObjects(item, `${path}[${index}]`, itemContext, appId, appName, item, helpers);
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach((key) => {
      const newPath = path ? `${path}.${key}` : key;
      extractObjects((obj as any)[key], newPath, newContext, appId, appName, obj, helpers);
    });
  }
}
