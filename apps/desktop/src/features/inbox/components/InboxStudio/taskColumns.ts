import type { ListGridColumn } from '@goodboy/ui';

export const TASK_ROW_HEIGHT = 32;

export const TASK_COLUMNS: ReadonlyArray<ListGridColumn> = [
  { key: 'source', width: 16 },
  { key: 'key', width: 88, tone: 'hint' },
  { key: 'title', width: 'fill', isTitle: true },
  { key: 'status', width: 16 },
  { key: 'priority', width: 16 },
  { key: 'updated', width: 48, align: 'end', isNumeric: true, tone: 'hint' },
];
