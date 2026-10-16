import type { ListGridColumn } from '@goodboy/ui';

export const HISTORY_COLUMNS = [
  { key: 'state', width: 16 },
  { key: 'session', width: 'fill', isTitle: true },
  { key: 'progress', width: 80, align: 'end', tone: 'hint' },
  { key: 'age', width: 56, align: 'end', isNumeric: true, tone: 'hint' },
  { key: 'cost', width: 48, align: 'end', isNumeric: true },
] as const satisfies ReadonlyArray<ListGridColumn>;
