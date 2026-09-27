import {
  listDiffCommentsForSession,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  markResolveQueueItemDelivered,
  resolveDiffComment,
  upsertResolveThread,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { noteIdOfThread } from '../../../features/resolve/notes/noteThread';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import type { SliceParams, ThreadParams } from './types';

type Params = SliceParams & ThreadParams;

export const NOTE_NOT_FOUND = 'This note is no longer open';

export const closeResolvedNote = async ({
  set,
  get,
  sessionId,
  threadId,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const row = (await listResolveThreads({ db, sessionId })).find(
    (candidate) => candidate.threadId === threadId,
  );
  const noteId = row?.diffCommentId ?? noteIdOfThread({ threadId });
  if (row === undefined || noteId === null) {
    throw new Error(NOTE_NOT_FOUND);
  }
  await resolveDiffComment(db, noteId);
  const now = Date.now();
  await upsertResolveThread({
    db,
    row: {
      ...row,
      state: 'closed',
      stage: 'resolved',
      stateReason: null,
      closedAt: now,
      closedSource: 'goodboy',
      updatedAt: now,
    },
    expectedRevision: row.revision,
  });
  const entry = (await listResolveQueueItems({ db, sessionId })).find(
    (candidate) => candidate.item.threadId === threadId,
  );
  if (entry !== undefined) {
    await markResolveQueueItemDelivered({ db, sessionId, itemId: entry.item.id, deliveredAt: now });
  }
  const notes = await listDiffCommentsForSession(db, sessionId);
  set((state) => ({ diffComments: { ...state.diffComments, [sessionId]: notes } }));
  await loadResolveQueueItemsInto({ set, sessionId });
  projectResolveRows({
    set,
    get,
    sessionId,
    rows: await listResolveThreads({ db, sessionId }),
    attempts: await listResolveAttempts({ db, sessionId }),
  });
};
