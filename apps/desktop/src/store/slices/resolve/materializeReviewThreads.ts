import {
  insertResolveQueueItem,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
} from '@goodboy/db';
import { saveResolveThread } from './saveResolveThread';
import { tauriDatabase } from '../../../shared/lib/db';
import { createResolveThread } from './createResolveThread';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { newQueueItem } from './newQueueItem';
import { openReviewThreadIds } from './openReviewThreadIds';
import { projectResolveRows } from './projectResolveRows';
import type { MaterializeParams, SliceParams } from './types';

type Params = SliceParams & MaterializeParams;

export const materializeReviewThreads = async ({
  set,
  get,
  sessionId,
  prNumber,
  projectId,
  comments,
}: Params): Promise<number> => {
  const threadIds = openReviewThreadIds({ comments });
  if (threadIds.length === 0 || prNumber <= 0) {
    return 0;
  }
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const queued = new Set(
    (await listResolveQueueItems({ db, sessionId })).map((entry) => entry.item.threadId),
  );
  let created = 0;
  for (const threadId of threadIds) {
    if (queued.has(threadId)) {
      continue;
    }
    const previous = rows.find((row) => row.threadId === threadId);
    if (previous !== undefined && (previous.prNumber !== prNumber || previous.state === 'closed')) {
      continue;
    }
    const row = previous ?? createResolveThread({ sessionId, threadId, projectId, prNumber });
    if (previous === undefined && !(await saveResolveThread({ db, row, expectedRevision: null }))) {
      continue;
    }
    await insertResolveQueueItem({
      db,
      item: newQueueItem({ sessionId, threadId, candidateRevision: row.revision }),
    });
    queued.add(threadId);
    created += 1;
  }
  if (created === 0) {
    return 0;
  }
  await loadResolveQueueItemsInto({ set, sessionId });
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
  return created;
};
