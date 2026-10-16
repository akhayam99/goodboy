import type { ListGridColumn } from '@goodboy/ui';

export const HISTORY_COLUMNS = [
  { key: 'session', width: 'fill', isTitle: true },
  { key: 'state', width: 104, tone: 'hint' },
  { key: 'age', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
  { key: 'cost', width: 48, align: 'end', isNumeric: true },
] as const satisfies ReadonlyArray<ListGridColumn>;
