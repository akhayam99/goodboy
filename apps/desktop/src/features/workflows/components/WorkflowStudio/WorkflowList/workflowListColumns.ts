import type { ListGridColumn } from '@goodboy/ui';

export const WORKFLOW_LIST_COLUMNS = [
  { key: 'name', width: 'fill', isTitle: true },
  { key: 'origin', width: 72 },
  { key: 'roles', width: 152 },
  { key: 'steps', width: 56, align: 'end', isNumeric: true },
  { key: 'lastRun', width: 72, align: 'end', isNumeric: true, tone: 'hint' },
  { key: 'runs', width: 56, align: 'end', isNumeric: true },
] as const satisfies ReadonlyArray<ListGridColumn>;
