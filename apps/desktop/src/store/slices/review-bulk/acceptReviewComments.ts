import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { acceptReviewItem } from '../../../features/resolve/acceptReviewItem';
import { isBulkAcceptable, isUndoableAccept } from '../../../features/resolve/bulkAccept';
import { postReplyWhenNothingWaits } from '../../../features/resolve/replyDelivery';
import { remoteOf } from '../../../features/resolve/reviewRemote';
import { replyOf, launchRowsOf, rowStateOf } from '../../../features/resolve/reviewRows';
import { activeReviewSourceOf } from '../review-source/activeReviewSource';
import type { SliceDeps } from '../../slice-types';
import type { ReviewBulkAcceptResult, ReviewBulkFailure } from './types';
import { undoAcceptedItems } from './undoAcceptedItems';

type Params = SliceDeps & {
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
};

const acceptedItemIdsOf = ({
  get,
  sessionId,
}: Pick<Params, 'get' | 'sessionId'>): ReadonlySet<string> =>
  new Set(
    launchRowsOf({ state: get(), sessionId })
      .filter((row) => isUndoableAccept({ row }))
      .map((row) => row.item.id),
  );

export const acceptReviewComments = async ({
  set,
  get,
  sessionId,
  threadIds,
}: Params): Promise<ReviewBulkAcceptResult> => {
  const before = acceptedItemIdsOf({ get, sessionId });
  const failures: Array<ReviewBulkFailure> = [];
  const accepted: Array<string> = [];
  for (const threadId of new Set(threadIds)) {
    const state = get();
    const row = launchRowsOf({ state, sessionId }).find(
      (candidate) => candidate.thread.threadId === threadId,
    );
    if (row === undefined) {
      continue;
    }
    const rowState = rowStateOf({ state, sessionId, row });
    const remote = remoteOf({
      state: rowState,
      facts: state.sessionThreadGit?.[sessionId]?.[threadId] ?? null,
    });
    if (!isBulkAcceptable({ state: rowState, remote })) {
      continue;
    }
    try {
      await acceptReviewItem({
        state,
        sessionId,
        threadId,
        itemId: row.item.id,
        revision: row.thread.revision,
        reply: replyOf({ draft: state.resolveItemDrafts[sessionId]?.[threadId], row }),
        isNote: row.thread.originKind === 'diff_comment',
        hasPr: activeReviewSourceOf({ state, sessionId }) !== null,
      });
      accepted.push(threadId);
    } catch (error) {
      failures.push({ threadId, message: formatError(error) });
    }
  }
  for (const threadId of accepted) {
    try {
      await postReplyWhenNothingWaits({ getState: get, sessionId, threadId });
    } catch (error) {
      failures.push({ threadId, message: formatError(error) });
    }
  }
  const itemIds = [...acceptedItemIdsOf({ get, sessionId })].filter((id) => !before.has(id));
  if (itemIds.length === 0) {
    return { acceptedCount: 0, failures };
  }
  const operationId = crypto.randomUUID();
  get().undoable({
    id: operationId,
    message: `${itemIds.length} accepted`,
    showToast: () => undefined,
    conflictMessage: 'These comments went out with a push. They cannot be undone.',
    isCurrent: () =>
      launchRowsOf({ state: get(), sessionId }).some(
        (row) => itemIds.includes(row.item.id) && isUndoableAccept({ row }),
      ),
    undo: () => undoAcceptedItems({ get, sessionId, itemIds }),
  });
  set((state) => ({
    reviewBulkAccepts: { ...state.reviewBulkAccepts, [sessionId]: { operationId, itemIds } },
  }));
  return { acceptedCount: itemIds.length, failures };
};
