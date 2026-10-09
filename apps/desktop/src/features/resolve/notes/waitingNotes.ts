import type { ResolveQueueRow } from '../buildResolveQueueRows';
import type { ResolveUiState } from '../resolveRowState';

const WAITING: ReadonlySet<ResolveUiState> = new Set([
  'new',
  'ready',
  'needs_you',
  'failed',
  'approved',
]);

export const waitingNotesOf = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): number =>
  rows.filter((row) => row.thread.originKind === 'diff_comment' && WAITING.has(row.status)).length;
