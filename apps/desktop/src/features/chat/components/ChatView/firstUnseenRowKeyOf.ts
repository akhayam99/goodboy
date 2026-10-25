import type { ConversationRow } from '../../utils/conversationRows';

type Params = {
  readonly rows: ReadonlyArray<ConversationRow>;
  readonly sinceMs: number | null;
};

type RowParams = {
  readonly row: ConversationRow;
};

const rowTimeMs = ({ row }: RowParams): number | null => {
  if (row.kind !== 'item' || !('at' in row.item) || typeof row.item.at !== 'string') {
    return null;
  }
  const parsed = Date.parse(row.item.at);
  return Number.isNaN(parsed) ? null : parsed;
};

export const firstUnseenRowKeyOf = ({ rows, sinceMs }: Params): string | null => {
  if (sinceMs === null) {
    return null;
  }
  let lastSeenIndex = -1;
  rows.forEach((row, index) => {
    const at = rowTimeMs({ row });
    if (at !== null && at <= sinceMs) {
      lastSeenIndex = index;
    }
  });
  const next = rows[lastSeenIndex + 1];
  if (lastSeenIndex === -1 || next === undefined) {
    return null;
  }
  const hasNewer = rows.some((row, index) => {
    const at = rowTimeMs({ row });
    return index > lastSeenIndex && at !== null && at > sinceMs;
  });
  return hasNewer ? next.key : null;
};
