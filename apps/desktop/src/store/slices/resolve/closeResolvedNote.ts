import {
  listDiffCommentsForSession,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  markResolveQueueItemDelivered,
  resolveDiffComment,
  upsertResolveThread,
} from '@goodboy/db';
import type { ResolveThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { noteIdOfThread } from '../../../features/resolve/notes/noteThread';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { projectResolveRows } from './projectResolveRows';
import type { SliceParams, ThreadParams } from './types';

type Params = SliceParams & ThreadParams;

const NOTE_NOT_FOUND = 'This note is no longer open';

const latestOpenRowOf = ({
  rows,
  noteId,
}: {
  readonly rows: ReadonlyArray<ResolveThread>;
  readonly noteId: string | null;
}): ResolveThread | undefined =>
  noteId === null
    ? undefined
    : rows
        .filter(
          (candidate) =>
            candidate.state !== 'closed' &&
            (candidate.diffCommentId ?? noteIdOfThread({ threadId: candidate.threadId })) ===
              noteId,
        )
        .reduce<ResolveThread | undefined>(
          (best, candidate) =>
            best === undefined || candidate.generation > best.generation ? candidate : best,
          undefined,
        );

export const closeResolvedNote = async ({
  set,
  get,
  sessionId,
  threadId,
}: Params): Promise<void> => {
  const db = tauriDatabase;
  const rows = await listResolveThreads({ db, sessionId });
  const wantedNoteId = noteIdOfThread({ threadId });
  const row =
    rows.find((candidate) => candidate.threadId === threadId && candidate.state !== 'closed') ??
    latestOpenRowOf({ rows, noteId: wantedNoteId });
  const noteId = row?.diffCommentId ?? wantedNoteId;
  if (noteId === null) {
    throw new Error(NOTE_NOT_FOUND);
  }
  await resolveDiffComment(db, noteId);
  if (row === undefined) {
    const notes = await listDiffCommentsForSession(db, sessionId);
    set((state) => ({ diffComments: { ...state.diffComments, [sessionId]: notes } }));
    return;
  }
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
    (candidate) => candidate.item.threadId === row.threadId,
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
