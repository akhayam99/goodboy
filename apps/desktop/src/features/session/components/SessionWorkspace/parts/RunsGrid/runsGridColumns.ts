import type { ListGridColumn } from '@goodboy/ui';

export const RUNS_GRID_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'shape', width: 16 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'origin', width: 200, tone: 'secondary', shouldHideWhenEmpty: true },
  { key: 'model', width: 152, tone: 'secondary', shouldHideWhenEmpty: true },
  { key: 'word', width: 112, tone: 'secondary' },
  { key: 'progress', width: 88, align: 'end', tone: 'hint' },
  { key: 'cost', width: 56, align: 'end', isNumeric: true },
  { key: 'age', width: 48, align: 'end', isNumeric: true, tone: 'hint' },
] as const satisfies ReadonlyArray<ListGridColumn>;
