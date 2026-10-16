import type { ListGridColumn } from '@goodboy/ui';

export const TERMINAL_LIST_COLUMNS = [
  { key: 'icon', width: 14 },
  { key: 'name', width: 'fill', isTitle: true },
  { key: 'port', width: 48, align: 'end', isNumeric: true, tone: 'hint' },
  { key: 'state', width: 16 },
] as const satisfies ReadonlyArray<ListGridColumn>;
