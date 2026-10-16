import type { ListGridColumn } from '@goodboy/ui';

export const RUNS_GRID_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'word', width: 128, tone: 'secondary', shouldHideWhenEmpty: true },
  { key: 'progress', width: 96, align: 'end', tone: 'hint' },
  { key: 'cost', width: 56, align: 'end', isNumeric: true },
  { key: 'age', width: 64, align: 'end', isNumeric: true, tone: 'hint' },
] as const satisfies ReadonlyArray<ListGridColumn>;
