import {
  insertResolveQueueItem,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
} from '@goodboy/db';
import type { ResolveQueueItem, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createResolveThread } from './createResolveThread';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import type { EnsureReviewThreadParams, EnsureReviewThreadResult, SliceParams } from './types';

type Params = SliceParams & EnsureReviewThreadParams;

type QueueItemParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly candidateRevision: number;
};

const queueItemFor = ({
  sessionId,
  threadId,
  candidateRevision,
}: QueueItemParams): ResolveQueueItem => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sessionId,
    threadId,
    generation: 0,
    reopenedFromItemId: null,
    candidateRevision,
    approvalState: 'none',
    approvedRevision: null,
    approvedReplyHash: null,
    integratedSha: null,
    deferredAt: null,
    deliveredAt: null,
    supersededAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

export const ensureReviewThread = async ({
  set,
  get,
  sessionId,
  threadId,
  prNumber,
}: Params): Promise<EnsureReviewThreadResult> => {
  if (threadId.trim() === '' || prNumber <= 0) {
    return 'missing';
  }
  if (!get().sessions.some((candidate) => candidate.id === sessionId)) {
    return 'missing';
  }
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const previous = rows.find((row) => row.threadId === threadId) ?? null;
  if (previous !== null && previous.prNumber !== prNumber) {
    return 'missing';
  }
  const items = await listResolveQueueItems({ db, sessionId });
  if (previous !== null && items.some((entry) => entry.item.threadId === threadId)) {
    return 'existing';
  }
  if (previous !== null && previous.state === 'closed') {
    return 'existing';
  }
  const remote = get().sessionGithub[sessionId]?.detail?.comments ?? [];
  const isRemote = remote.some(
    (comment) => comment.source === 'review' && comment.threadId === threadId,
  );
  if (previous === null && !isRemote) {
    return 'missing';
  }
  const row =
    previous ??
    createResolveThread({
      sessionId,
      threadId,
      projectId: get().sessionActiveProject[sessionId] ?? null,
      prNumber,
    });
  if (previous === null && !(await upsertResolveThread({ db, row, expectedRevision: null }))) {
    return 'missing';
  }
  await insertResolveQueueItem({
    db,
    item: queueItemFor({ sessionId, threadId, candidateRevision: row.revision }),
  });
  await loadResolveQueueItemsInto({ set, sessionId });
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
  return 'created';
};
