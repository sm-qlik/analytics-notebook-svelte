import { describe, it, expect } from 'vitest';
import { createSheetDimensionIndexItem, createSheetMeasureIndexItem } from './search-utils';

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

  it('builds SearchIndexItem for live master dimension reference', () => {
    const cacheKey = 'services.eu.qlikcloud.com::68f7977183369c7d4ddbc86f';
    const appId = '4c64553d-b002-49ee-ba12-0c7ddda7f3f3';
    const appName = 'Access Evaluator';
    const spaceId = '5fd9e29668e787000136c2eb';
    const idx = 19;

    const dim = {
        "sheetId": "39fc256a-0d7e-4ab6-a8de-a904c639e097",
        "sheetTitle": "Access Evaluation",
        "sheetUrl": "https://services.eu.qlikcloud.com//sense/app/4c64553d-b002-49ee-ba12-0c7ddda7f3f3/sheet/39fc256a-0d7e-4ab6-a8de-a904c639e097",
        "chartId": "90bf94fb-e028-4b1e-8d2a-12276376b8b7",
        "chartType": "pivot-table",
        "chartTitle": null,
        "chartUrl": "https://services.eu.qlikcloud.com//sense/app/4c64553d-b002-49ee-ba12-0c7ddda7f3f3/sheet/39fc256a-0d7e-4ab6-a8de-a904c639e097/chartId/90bf94fb-e028-4b1e-8d2a-12276376b8b7",
        "qLibraryId": "pHQjcC"
    };

    const getSheetStatus = (sheetId: string) => ({ approved: true, published: true });

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
    expect(item.path).toBe(`sheetDimensions[19].qDef`);
    expect(item.id).toBe('services.eu.qlikcloud.com::68f7977183369c7d4ddbc86f:4c64553d-b002-49ee-ba12-0c7ddda7f3f3:sheetDimensions[19].qDef');

    expect(item.appId).toBe(appId);
    expect(item.appName).toBe(appName);
    expect(item.spaceId).toBe(spaceId);

    expect(item.sheetId).toBe('39fc256a-0d7e-4ab6-a8de-a904c639e097');
    expect(item.sheetName).toBe('Access Evaluation');
    expect(item.sheetUrl).toBe('https://services.eu.qlikcloud.com//sense/app/4c64553d-b002-49ee-ba12-0c7ddda7f3f3/sheet/39fc256a-0d7e-4ab6-a8de-a904c639e097');

    expect(item.chartId).toBe('90bf94fb-e028-4b1e-8d2a-12276376b8b7');
    expect(item.chartTitle).toBe('');
    expect(item.chartUrl).toBe('https://services.eu.qlikcloud.com//sense/app/4c64553d-b002-49ee-ba12-0c7ddda7f3f3/sheet/39fc256a-0d7e-4ab6-a8de-a904c639e097/chartId/90bf94fb-e028-4b1e-8d2a-12276376b8b7');

    expect(item.sheetApproved).toBe(true);
    expect(item.sheetPublished).toBe(true);

    // No name or definiton for master dimension refernce!
    expect(item.nameText).toBe('');
    expect(item.definition).toBe('');

    expect(item.searchText).toContain('Access Evaluation');
  });   
});

describe('createSheetMeasureIndexItem', () => {
  it('builds a proper SearchIndexItem for a sheet measure', () => {
    const cacheKey = 'tenant:user';
    const appId = 'app-123';
    const appName = 'My App';
    const spaceId = 'space-1';
    const idx = 1;
    const getSheetStatus = (sheetId: string) => ({ approved: sheetId === 'sheet-xyz', published: true });
    const measure = {
      sheetId: 'sheet-xyz',
      sheetTitle: 'Profit Overview',
      sheetUrl: 'https://tenant/app/app-123/sheet/sheet-xyz',
      chartId: 'chart-456',
      chartTitle: 'Profit by Product',
      chartUrl: 'https://tenant/app/app-123/sheet/sheet-xyz/chart/chart-456',
      qDef: 'sum(Profit)',
      title: 'Sheet Measure Title'
    };

    const item = createSheetMeasureIndexItem(cacheKey, appId, appName, spaceId, measure, idx, getSheetStatus);

    expect(item.objectType).toBe('Sheet Measure');
    expect(item.path).toBe('sheetMeasures[1].qDef');
    expect(item.id).toBe(`${cacheKey}:${appId}:sheetMeasures[1].qDef`);
    expect(item.appId).toBe(appId);
    expect(item.appName).toBe(appName);
    expect(item.spaceId).toBe(spaceId);
    expect(item.sheetId).toBe('sheet-xyz');
    expect(item.sheetName).toBe('Profit Overview');
    expect(item.sheetUrl).toBe('https://tenant/app/app-123/sheet/sheet-xyz');
    expect(item.sheetApproved).toBe(true);
    expect(item.sheetPublished).toBe(true);
    expect(item.title).toBe('');
    expect(item.name).toEqual([]);
    expect(item.nameText).toBe('');
    expect(item.definition).toBe('sum(Profit)');
    expect(item.chartId).toBe('chart-456');
    expect(item.chartTitle).toBe('Profit by Product');
    expect(item.chartUrl).toBe('https://tenant/app/app-123/sheet/sheet-xyz/chart/chart-456');
    expect(item.searchText).toContain('Profit by Product');
    expect(item.searchText).toContain('sum(Profit)');
    expect(item.searchText).toContain('Profit Overview');
    expect(item.searchText).toContain('Profit by Product');
  });

  it('builds a proper SearchIndexItem for a live master measure reference', () => {
    const cacheKey = 'tenant:user';
    const appId = 'app-123';
    const appName = 'My App';
    const spaceId = 'space-1';
    const idx = 1;
    const getSheetStatus = (sheetId: string) => ({ approved: true, published: true });
    const measure = {
    "sheetId": "5179f882-d67d-4e28-a7ef-049fe04de93e",
    "sheetTitle": "HeatMap activity",
    "sheetUrl": "https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/5179f882-d67d-4e28-a7ef-049fe04de93e",
    "chartId": "YqAp",
    "chartType": "pivot-table",
    "chartTitle": "When users are active?",
    "chartUrl": "https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/5179f882-d67d-4e28-a7ef-049fe04de93e/chartId/YqAp",
    "qLibraryId": "ePUVWf"
};

    const item = createSheetMeasureIndexItem(cacheKey, appId, appName, spaceId, measure, idx, getSheetStatus);

    expect(item.objectType).toBe('Sheet Measure');
    expect(item.path).toBe('sheetMeasures[1].qDef');
    expect(item.id).toBe(`${cacheKey}:${appId}:sheetMeasures[1].qDef`);
    expect(item.appId).toBe(appId);
    expect(item.appName).toBe(appName);
    expect(item.spaceId).toBe(spaceId);
    expect(item.sheetId).toBe('5179f882-d67d-4e28-a7ef-049fe04de93e');
    expect(item.sheetName).toBe('HeatMap activity');
    expect(item.sheetUrl).toBe('https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/5179f882-d67d-4e28-a7ef-049fe04de93e');
    expect(item.sheetApproved).toBe(true);
    expect(item.sheetPublished).toBe(true);
    expect(item.title).toBe('');
    expect(item.name).toEqual([]);
    expect(item.nameText).toBe('');
    expect(item.definition).toBe('');
    expect(item.chartId).toBe('YqAp');
    expect(item.chartTitle).toBe('When users are active?');
    expect(item.chartUrl).toBe('https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/5179f882-d67d-4e28-a7ef-049fe04de93e/chartId/YqAp');
    expect(item.searchText).toContain('HeatMap activity');
    expect(item.searchText).toContain('When users are active');
  }); 
  
  it('builds a proper SearchIndexItem for a live sheet measure', () => {
    const cacheKey = 'tenant:user';
    const appId = 'app-123';
    const appName = 'My App';
    const spaceId = 'space-1';
    const idx = 1;
    const getSheetStatus = (sheetId: string) => ({ approved: true, published: true });
    const measure = {
        "sheetId": "bcf03f5b-3b98-402d-81e9-ba86cf8ff46d",
        "sheetTitle": "App Follow Up",
        "sheetUrl": "https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/bcf03f5b-3b98-402d-81e9-ba86cf8ff46d",
        "chartId": "RXPRbU",
        "chartType": "table",
        "chartTitle": null,
        "chartUrl": "https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/bcf03f5b-3b98-402d-81e9-ba86cf8ff46d/chartId/RXPRbU",
        "qLibraryId": "",
        "qDef": {
            "qLabel": "Deletor",
            "qDescription": "",
            "qTags": [],
            "qGrouping": "N",
            "qDef": "=MaxString({$<eventType={'com.qlik.app.deleted'}>}  [Users email])",
            "qNumFormat": {
                "qType": "U",
                "qnDec": 10,
                "qUseThou": 0,
                "qFmt": "",
                "qDec": "",
                "qThou": ""
            },
            "qRelative": false,
            "qBrutalSum": false,
            "qAggrFunc": "Expr",
            "qAccumulate": 0,
            "qReverseSort": false,
            "qActiveExpression": 0,
            "qExpressions": [],
            "qLabelExpression": "",
            "autoSort": true,
            "cId": "JgpEDc",
            "numFormatFromTemplate": true,
            "textAlign": {
                "auto": true,
                "align": "left"
            },
            "representation": {
                "type": "text",
                "indicator": {
                    "showTextValues": true,
                    "applySegmentColors": false,
                    "position": "right"
                },
                "miniChart": {
                    "type": "sparkline",
                    "colors": {
                        "main": {
                            "index": 6
                        },
                        "max": {
                            "index": 0,
                            "color": "none"
                        },
                        "min": {
                            "index": 0,
                            "color": "none"
                        },
                        "first": {
                            "index": 0,
                            "color": "none"
                        },
                        "last": {
                            "index": 0,
                            "color": "none"
                        },
                        "positive": {
                            "index": 6
                        },
                        "negative": {
                            "index": 10,
                            "color": "#f93f17"
                        }
                    },
                    "showDots": true,
                    "yAxis": {
                        "scale": "local",
                        "position": "auto"
                    }
                }
            },
            "conditionalColoring": {
                "segments": {
                    "limits": [],
                    "paletteColors": [
                        {
                            "index": 6,
                            "icon": "dot"
                        }
                    ]
                }
            }
        },
        "qSortBy": {
            "qSortByState": 0,
            "qSortByFrequency": 0,
            "qSortByNumeric": -1,
            "qSortByAscii": 0,
            "qSortByLoadOrder": 1,
            "qSortByExpression": 0,
            "qExpression": {
                "qv": ""
            },
            "qSortByGreyness": 0
        },
        "qAttributeExpressions": [],
        "qAttributeDimensions": [],
        "qCalcCond": {
            "qv": ""
        },
        "qCalcCondition": {
            "qCond": {
                "qv": ""
            },
            "qMsg": {
                "qv": ""
            }
        },
        "qTrendLines": [],
        "qMiniChartDef": {
            "qDef": "",
            "qLibraryId": "",
            "qSortBy": {
                "qSortByState": 0,
                "qSortByFrequency": 0,
                "qSortByNumeric": 0,
                "qSortByAscii": 0,
                "qSortByLoadOrder": 0,
                "qSortByExpression": 0,
                "qExpression": {
                    "qv": ""
                },
                "qSortByGreyness": 0
            },
            "qOtherTotalSpec": {
                "qOtherMode": "OTHER_OFF",
                "qOtherCounted": {
                    "qv": ""
                },
                "qOtherLimit": {
                    "qv": ""
                },
                "qOtherLimitMode": "OTHER_GT_LIMIT",
                "qSuppressOther": true,
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
            "qMaxNumberPoints": -1,
            "qAttributeExpressions": [],
            "qNullSuppression": true
        }
    };

    const item = createSheetMeasureIndexItem(cacheKey, appId, appName, spaceId, measure, idx, getSheetStatus);

    expect(item.objectType).toBe('Sheet Measure');
    expect(item.path).toBe('sheetMeasures[1].qDef');
    expect(item.id).toBe(`${cacheKey}:${appId}:sheetMeasures[1].qDef`);
    expect(item.appId).toBe(appId);
    expect(item.appName).toBe(appName);
    expect(item.spaceId).toBe(spaceId);
    expect(item.sheetId).toBe('bcf03f5b-3b98-402d-81e9-ba86cf8ff46d');
    expect(item.sheetName).toBe('App Follow Up');
    expect(item.sheetUrl).toBe('https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/bcf03f5b-3b98-402d-81e9-ba86cf8ff46d');
    expect(item.sheetApproved).toBe(true);
    expect(item.sheetPublished).toBe(true);
    expect(item.title).toBe('Deletor');
    expect(item.name).toEqual(['Deletor']);
    expect(item.nameText).toBe('Deletor');
    expect(item.definition).toBe("=MaxString({$<eventType={'com.qlik.app.deleted'}>}  [Users email])");
    expect(item.chartId).toBe('RXPRbU');
    expect(item.chartTitle).toBe('');
    expect(item.chartUrl).toBe('https://services.eu.qlikcloud.com//sense/app/ee0f43e9-1506-45e1-91ff-9a8b7703f7fa/sheet/bcf03f5b-3b98-402d-81e9-ba86cf8ff46d/chartId/RXPRbU');
    expect(item.searchText).toContain('Deletor');
    expect(item.searchText).toContain('com.qlik.app.deleted');
    expect(item.searchText).toContain('email');
    expect(item.searchText).toContain('App Follow Up');
  });  
});

