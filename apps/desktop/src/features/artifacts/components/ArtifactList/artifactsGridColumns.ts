import type { ListGridColumn } from '@goodboy/ui';

export const ARTIFACTS_GRID_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'shape', width: 16 },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'word', width: 112, tone: 'secondary', hideBelow: 520 },
  { key: 'age', width: 64, align: 'end', isNumeric: true, tone: 'hint', hideBelow: 420 },
  { key: 'verb', width: 112, align: 'end', shouldHideWhenEmpty: true },
] as const satisfies ReadonlyArray<ListGridColumn>;
