import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveUiState } from './resolveRowState';

const WAITING: ReadonlySet<ResolveUiState> = new Set([
  'new',
  'ready',
  'needs_you',
  'failed',
  'approved',
]);

type Waiting = {
  readonly comments: number;
  readonly notes: number;
};

export const conversationsWaiting = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): Waiting => {
  const waiting = rows.filter((row) => WAITING.has(row.status));
  const notes = waiting.filter((row) => row.thread.originKind === 'diff_comment').length;
  return { comments: waiting.length - notes, notes };
};
