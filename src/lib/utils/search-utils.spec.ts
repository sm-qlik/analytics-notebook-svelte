import { describe, it, expect } from 'vitest';
import { createSheetDimensionIndexItem } from './search-utils';

describe('createSheetDimensionIndexItem', () => {
  it('builds a proper SearchIndexItem for a sheet dimension', () => {
    const cacheKey = 'tenant:user';
    const appId = 'app-123';
    const appName = 'My App';
    const spaceId = 'space-1';
    const idx = 2;

    const dim = {
      sheetId: 'sheet-abc',
      sheetTitle: 'Sales Overview',
      sheetUrl: 'https://tenant/app/app-123/sheet/sheet-abc',
      chartId: 'chart-789',
      chartTitle: 'Revenue by Region',
      chartUrl: 'https://tenant/app/app-123/sheet/sheet-abc/chart/chart-789',
      qDef: { qDef: 'sum(Sales)', qFieldLabels: ['Region', { qv: 'Ignored non-string' }, 42] },     
      title: 'Dimension Title'
    };

    const getSheetStatus = (sheetId: string) => ({ approved: sheetId === 'sheet-abc', published: true });

    const item = createSheetDimensionIndexItem(
      cacheKey,
      appId,
      appName,
      spaceId,
      dim,
      idx,
      getSheetStatus
    );

    expect(item.objectType).toBe('Sheet Dimension');
    expect(item.path).toBe(`sheetDimensions[${idx}].qDef`);
    expect(item.id).toBe(`${cacheKey}:${appId}:${item.path}`);

    expect(item.appId).toBe(appId);
    expect(item.appName).toBe(appName);
    expect(item.spaceId).toBe(spaceId);

    expect(item.sheetId).toBe('sheet-abc');
    expect(item.sheetName).toBe('Sales Overview');
    expect(item.sheetUrl).toContain('sheet-abc');

    expect(item.chartId).toBe('chart-789');
    expect(item.chartTitle).toBe('Revenue by Region');
    expect(item.chartUrl).toContain('chart-789');

    expect(item.sheetApproved).toBe(true);
    expect(item.sheetPublished).toBe(true);

    // Name array should include only string labels
    expect(item.name).toEqual(['Region']);
    expect(item.nameText).toBe('Region');

    // Definition extracted from qDef
    expect(item.definition).toBe('sum(Sales)');

    // Search text should include key pieces for indexing
    expect(item.searchText).toContain('Dimension Title');
    expect(item.searchText).toContain('sum(Sales)');
    expect(item.searchText).toContain('Sales Overview');
    expect(item.searchText).toContain('Revenue by Region');
    expect(item.searchText).toContain('Region');
  });

  it('builds SearchIndexItem for live Answers Analyzer sheet dimension', () => {
    const cacheKey = 'services.eu.qlikcloud.com::68f7977183369c7d4ddbc86f';
    const appId = '94e1806c-df6c-4064-817d-8aa10484b92c';
    const appName = 'My App';
    const spaceId = 'space-1';
    const idx = 0;

    const dim = {
    "sheetId": "324e46a8-0d3c-4ce3-8137-6b7af14d58d4",
    "sheetTitle": "Dashboard",
    "sheetUrl": "https://services.eu.qlikcloud.com//sense/app/94e1806c-df6c-4064-817d-8aa10484b92c/sheet/324e46a8-0d3c-4ce3-8137-6b7af14d58d4",
    "chartId": "a267618d-a5d8-4614-8c52-e87629b5a291",
    "chartType": "table",
    "chartTitle": "Knowledgebases",
    "chartUrl": "https://services.eu.qlikcloud.com//sense/app/94e1806c-df6c-4064-817d-8aa10484b92c/sheet/324e46a8-0d3c-4ce3-8137-6b7af14d58d4/chartId/a267618d-a5d8-4614-8c52-e87629b5a291",
    "qLibraryId": "",
    "qDef": {
        "qGrouping": "N",
        "qFieldDefs": [
            "KnowledgeBaseName"
        ],
        "qFieldLabels": [
            "Knowledgebase Name"
        ],
        "qSortCriterias": [
            {
                "qSortByState": 0,
                "qSortByFrequency": 0,
                "qSortByNumeric": 1,
                "qSortByAscii": 1,
                "qSortByLoadOrder": 1,
                "qSortByExpression": 0,
                "qExpression": {
                    "qv": ""
                },
                "qSortByGreyness": 0
            }
        ],
        "qNumberPresentations": [],
        "qReverseSort": false,
        "qActiveField": 0,
        "qLabelExpression": "",
        "qAlias": "Knowledgebase Name",
        "autoSort": true,
        "cId": "XycmCv",
        "othersLabel": "Others",
        "textAlign": {
            "auto": true,
            "align": "left"
        },
        "representation": {
            "type": "text",
            "urlPosition": "dimension",
            "urlLabel": "",
            "linkUrl": "",
            "imageSetting": "label",
            "imageLabel": "",
            "imageUrl": "",
            "imageSize": "fitHeight",
            "imagePosition": "topCenter"
        }
    },
    "qNullSuppression": true,
    "qIncludeElemValue": false,
    "qOtherTotalSpec": {
        "qOtherMode": "OTHER_OFF",
        "qOtherCounted": {
            "qv": "10"
        },
        "qOtherLimit": {
            "qv": "0"
        },
        "qOtherLimitMode": "OTHER_GE_LIMIT",
        "qSuppressOther": false,
        "qForceBadValueKeeping": true,
        "qApplyEvenWhenPossiblyWrongResult": true,
        "qGlobalOtherGrouping": false,
        "qOtherCollapseInnerDimensions": false,
        "qOtherSortMode": "OTHER_SORT_DESCENDING",
        "qTotalMode": "TOTAL_OFF",
        "qReferencedExpression": {
            "qv": ""
        }
    },
    "qShowTotal": false,
    "qShowAll": false,
    "qOtherLabel": {
        "qv": "Others"
    },
    "qTotalLabel": {
        "qv": ""
    },
    "qCalcCond": {
        "qv": ""
    },
    "qAttributeExpressions": [],
    "qAttributeDimensions": [],
    "qCalcCondition": {
        "qCond": {
            "qv": ""
        },
        "qMsg": {
            "qv": ""
        }
    }
};

    const getSheetStatus = (sheetId: string) => ({ approved: false, published: true });

    const item = createSheetDimensionIndexItem(
      cacheKey,
      appId,
      appName,
      spaceId,
      dim,
      idx,
      getSheetStatus
    );

    expect(item.objectType).toBe('Sheet Dimension');
    expect(item.path).toBe(`sheetDimensions[0].qDef`);
    expect(item.id).toBe('services.eu.qlikcloud.com::68f7977183369c7d4ddbc86f:94e1806c-df6c-4064-817d-8aa10484b92c:sheetDimensions[0].qDef');

    expect(item.appId).toBe(appId);
    expect(item.appName).toBe(appName);
    expect(item.spaceId).toBe(spaceId);

    expect(item.sheetId).toBe('324e46a8-0d3c-4ce3-8137-6b7af14d58d4');
    expect(item.sheetName).toBe('Dashboard');
    expect(item.sheetUrl).toBe('https://services.eu.qlikcloud.com//sense/app/94e1806c-df6c-4064-817d-8aa10484b92c/sheet/324e46a8-0d3c-4ce3-8137-6b7af14d58d4');

    expect(item.chartId).toBe('a267618d-a5d8-4614-8c52-e87629b5a291');
    expect(item.chartTitle).toBe('Knowledgebases');
    expect(item.chartUrl).toBe('https://services.eu.qlikcloud.com//sense/app/94e1806c-df6c-4064-817d-8aa10484b92c/sheet/324e46a8-0d3c-4ce3-8137-6b7af14d58d4/chartId/a267618d-a5d8-4614-8c52-e87629b5a291');

    expect(item.sheetApproved).toBe(false);
    expect(item.sheetPublished).toBe(true);

    // Name array TODO
    // expect(item.name).toEqual(['Region']);
    expect(item.nameText).toBe('Knowledgebase Name');

    // Definition extracted from qDef
    expect(item.definition).toBe('KnowledgeBaseName');

    expect(item.searchText).toContain('KnowledgeBaseName');
    expect(item.searchText).toContain('Dashboard');
    expect(item.searchText).toContain('Knowledgebases');
  });  
});
