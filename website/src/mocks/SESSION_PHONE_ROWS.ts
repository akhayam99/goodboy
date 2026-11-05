import type { RunTreeRowData } from './kit';
import { SESSION_ROWS } from './SESSION_ROWS';

const PHONE_ROW_IDS: ReadonlySet<string> = new Set([
  'step-5',
  'step-4-2',
  'step-4-1',
  'step-4',
  'step-3',
]);

export const SESSION_PHONE_ROWS: ReadonlyArray<RunTreeRowData> = SESSION_ROWS.filter((row) =>
  PHONE_ROW_IDS.has(row.id),
);
