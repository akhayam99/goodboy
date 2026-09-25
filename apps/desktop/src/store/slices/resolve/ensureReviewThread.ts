import {
  insertResolveQueueItem,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
} from '@goodboy/db';
import type { PrComment } from '@goodboy/types';
import { groupThreads } from '../../../features/github/comment-threads';
import { tauriDatabase } from '../../../shared/lib/db';
import { createResolveThread } from './createResolveThread';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { newQueueItem } from './newQueueItem';
import { projectResolveRows } from './projectResolveRows';
import type { EnsureReviewThreadParams, EnsureReviewThreadResult, SliceParams } from './types';

type Params = SliceParams & EnsureReviewThreadParams;

type RemoteHeadParams = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly threadId: string;
};

const remoteHeadOf = ({ comments, threadId }: RemoteHeadParams): PrComment | null => {
  const thread = groupThreads(comments.filter((comment) => comment.source === 'review')).find(
    (candidate) => candidate.head.threadId === threadId,
  );
  return thread?.head ?? null;
};

export const ensureReviewThread = async ({
  set,
  get,
  sessionId,
  threadId,
  prNumber,
  isCancelled,
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
    return 'closed';
  }
  if (previous === null) {
    const head = remoteHeadOf({
      comments: get().sessionGithub[sessionId]?.detail?.comments ?? [],
      threadId,
    });
    if (head === null) {
      return 'missing';
    }
    if (head.resolved === true) {
      return 'closed';
    }
  }
  if (isCancelled?.() === true) {
    return 'cancelled';
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
    item: newQueueItem({ sessionId, threadId, candidateRevision: row.revision }),
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
