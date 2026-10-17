import type { ListGridColumn } from '@goodboy/ui';

export const HISTORY_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'session', width: 'fill', isTitle: true },
  { key: 'cost', width: 48, align: 'end', isNumeric: true, shouldHideWhenEmpty: true },
  { key: 'age', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
] as const satisfies ReadonlyArray<ListGridColumn>;
