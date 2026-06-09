import type { TranscriptItem } from './transcript-items';

const OPERATION_KINDS = new Set<TranscriptItem['kind']>([
  'tool_call',
  'file_edit',
  'skill_invocation',
]);

const ABSORBED_KINDS = new Set<TranscriptItem['kind']>(['usage']);

export type TranscriptRow =
  | { kind: 'item'; key: string; item: TranscriptItem }
  | { kind: 'operations'; key: string; items: ReadonlyArray<TranscriptItem> };

export const clusterOperations = (
  items: ReadonlyArray<TranscriptItem>,
): ReadonlyArray<TranscriptRow> => {
  const rows: TranscriptRow[] = [];
  let buffer: TranscriptItem[] = [];

  const flush = () => {
    if (buffer.length === 0) {
      return;
    }
    if (buffer.some((i) => OPERATION_KINDS.has(i.kind))) {
      rows.push({ kind: 'operations', key: `ops-${buffer[0]!.key}`, items: buffer });
    } else {
      for (const item of buffer) rows.push({ kind: 'item', key: item.key, item });
    }
    buffer = [];
  };

  for (const item of items) {
    if (OPERATION_KINDS.has(item.kind) || ABSORBED_KINDS.has(item.kind)) {
      buffer.push(item);
    } else {
      flush();
      rows.push({ kind: 'item', key: item.key, item });
    }
  }
  flush();
  return rows;
};
