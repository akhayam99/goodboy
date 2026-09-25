import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ResolveUiState } from './resolveRowState';

const WAITING: ReadonlySet<ResolveUiState> = new Set([
  'new',
  'ready',
  'needs_you',
  'failed',
  'approved',
]);

export const isConversationOpen = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.status !== 'resolved' && row.status !== 'later';

export const conversationsWaiting = ({
  rows,
}: {
  readonly rows: ReadonlyArray<ResolveQueueRow>;
}): number => rows.filter((row) => WAITING.has(row.status)).length;
