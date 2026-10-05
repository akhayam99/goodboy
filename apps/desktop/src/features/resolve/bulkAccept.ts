import type { ThreadRemoteKind } from '../../store/slices/resolve/threadGitState';
import type { ResolveQueueRow } from './buildResolveQueueRows';
import type { ReviewCommentState } from './reviewCommentState';

export const isBulkAcceptable = ({
  state,
  remote,
}: {
  readonly state: ReviewCommentState;
  readonly remote: ThreadRemoteKind | null;
}): boolean => (state === 'ready' || state === 'edited') && remote === null;

export const isUndoableAccept = ({ row }: { readonly row: ResolveQueueRow }): boolean =>
  row.item.approvalState === 'accepted' && row.thread.stage === 'approved';
