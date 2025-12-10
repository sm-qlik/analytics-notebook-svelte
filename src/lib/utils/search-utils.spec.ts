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
      qDef: { qDef: 'sum(Sales)' },
      qFieldLabels: ['Region', { qv: 'Ignored non-string' }, 42],
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
});
