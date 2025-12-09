export interface SearchResultItem {
  path: string;
  object: any;
  objectType: string | null;
  context: any;
  file?: string;
  app?: string;
  appId: string;
  sheet?: string | null;
  sheetName?: string | null;
  sheetId?: string | null;
  sheetUrl?: string | null;
  chartId?: string | null;
  chartTitle?: string | null;
  chartUrl?: string | null;
  labels?: string[];
}

// Optional convenience class for constructing items with defaults
export class SearchResultItemImpl implements SearchResultItem {
  path: string;
  object: any;
  objectType: string | null;
  context: any;
  file?: string;
  app?: string;
  appId: string;
  sheet?: string | null;
  sheetName?: string | null;
  sheetId?: string | null;
  sheetUrl?: string | null;
  chartId?: string | null;
  chartTitle?: string | null;
  chartUrl?: string | null;
  labels?: string[];

  constructor(init: Partial<SearchResultItem> & Pick<SearchResultItem, 'path' | 'object' | 'objectType' | 'context' | 'appId'>) {
    this.path = init.path;
    this.object = init.object;
    this.objectType = init.objectType;
    this.context = init.context;
    this.appId = init.appId;
    this.file = init.file;
    this.app = init.app;
    this.sheet = init.sheet ?? null;
    this.sheetName = init.sheetName ?? init.sheet ?? null;
    this.sheetId = init.sheetId ?? null;
    this.sheetUrl = init.sheetUrl ?? null;
    this.chartId = init.chartId ?? null;
    this.chartTitle = init.chartTitle ?? null;
    this.chartUrl = init.chartUrl ?? null;
    this.labels = init.labels ?? [];
  }
}
