import type { ListGridColumn } from '@goodboy/ui';

export const QUESTIONS_GRID_COLUMNS = [
  { key: 'state', width: 16, shouldHideWhenEmpty: true },
  { key: 'title', width: 'fill', isTitle: true, canSpanEmpty: true },
  { key: 'age', width: 64, align: 'end', isNumeric: true, tone: 'hint' },
] as const satisfies ReadonlyArray<ListGridColumn>;
