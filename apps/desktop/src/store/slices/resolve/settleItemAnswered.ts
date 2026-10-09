import {
  listResolveQueueItems,
  listResolveThreads,
  rebaseResolveQueueItem,
  setResolveQueueItemApproval,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { STALE_APPROVAL } from './staleApproval';
import { advanceResolveStage } from './advanceResolveStage';
import { hashResolveReply } from './hashResolveReply';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import { saveResolveThread } from './saveResolveThread';
import type { ItemParams, SliceParams } from './types';

type Params = SliceParams &
  ItemParams & { readonly reply: string; readonly allowIntegrated?: boolean };

const RESOLVE_ONLY_REASON = 'resolve_only';
const RESOLVE_ONLY_AFTER_INTEGRATION =
  'This fix is already on the branch. Undo the decision before resolving without a reply';

export const settleItemAnswered = async ({
  set,
  get,
  sessionId,
  itemId,
  reply,
  allowIntegrated = false,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const target = (await listResolveQueueItems({ db, sessionId })).find(
    (entry) => entry.item.id === itemId,
  );
  if (target === undefined) {
    throw new Error('This comment is no longer in Comments');
  }
  if (target.item.integratedSha !== null && !allowIntegrated) {
    throw new Error(RESOLVE_ONLY_AFTER_INTEGRATION);
  }
  const previous = (await listResolveThreads({ db, sessionId })).find(
    (row) => row.threadId === target.thread.threadId,
  );
  if (previous === undefined) {
    throw new Error(STALE_APPROVAL);
  }
  const saved = await saveResolveThread({
    db,
    row: {
      ...previous,
      state: 'answered',
      stateReason: RESOLVE_ONLY_REASON,
      disposition: 'no_change',
      replyDraft: reply === '' ? null : reply,
      commitShas: null,
      question: null,
      updatedAt: Date.now(),
    },
    expectedRevision: previous.revision,
    previous,
  });
  if (!saved) {
    throw new Error(STALE_APPROVAL);
  }
  const rows = await listResolveThreads({ db, sessionId });
  const current = rows.find((row) => row.threadId === previous.threadId);
  const revision = current?.revision ?? previous.revision + 1;
  await rebaseResolveQueueItem({ db, sessionId, itemId, candidateRevision: revision });
  const accepted = await setResolveQueueItemApproval({
    db,
    sessionId,
    itemId,
    revision,
    replyHash: await hashResolveReply({ reply }),
  });
  if (!accepted) {
    throw new Error(STALE_APPROVAL);
  }
  projectResolveRows({
    set,
    get,
    sessionId,
    rows,
    attempts: get().sessionResolveAttempts[sessionId] ?? [],
  });
  await advanceResolveStage({
    set,
    sessionId,
    threadIds: [previous.threadId],
    event: () => ({ kind: 'user_approved' }),
  });
  await loadResolveQueueItemsInto({ set, sessionId });
};
