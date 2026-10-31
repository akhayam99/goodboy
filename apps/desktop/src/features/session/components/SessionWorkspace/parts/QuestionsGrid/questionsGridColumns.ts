import type { ListGridColumn } from '@goodboy/ui';

export const QUESTIONS_GRID_COLUMNS = [
  { key: 'state', width: 16, shouldHideWhenEmpty: true },
  { key: 'question', width: 'fill', isTitle: true, canSpanEmpty: true },
  { key: 'asker', width: 96, tone: 'secondary', shouldHideWhenEmpty: true },
  { key: 'age', width: 64, align: 'end', isNumeric: true, tone: 'hint' },
] as const satisfies ReadonlyArray<ListGridColumn>;
