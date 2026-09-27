import {
  insertResolveQueueItem,
  listDiffCommentsForSession,
  listResolveAttempts,
  listResolveQueueItems,
  listResolveThreads,
  upsertResolveThread,
} from '@goodboy/db';
import type { DiffComment, ResolveThread } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  isOpenNote,
  noteIdOfThread,
  noteThreadId,
} from '../../../features/resolve/notes/noteThread';
import { createResolveThread } from './createResolveThread';
import { loadResolveQueueItemsInto } from './loadResolveQueueItemsInto';
import { newQueueItem } from './newQueueItem';
import { projectResolveRows } from './projectResolveRows';
import { saveResolveThread } from './saveResolveThread';
import type { SessionParams, SliceParams } from './types';

type Params = SliceParams & SessionParams;

type ClosingParams = {
  readonly row: ResolveThread;
  readonly notes: ReadonlyMap<string, DiffComment>;
};

const isNoteGone = ({ row, notes }: ClosingParams): boolean => {
  if (row.originKind !== 'diff_comment' || row.state === 'closed') {
    return false;
  }
  const noteId = row.diffCommentId ?? noteIdOfThread({ threadId: row.threadId });
  if (noteId === null) {
    return false;
  }
  const note = notes.get(noteId);
  return note === undefined || !isOpenNote({ note });
};

export const syncNoteThreads = async ({ set, get, sessionId }: Params): Promise<number> => {
  const db = tauriDatabase;
  const notes = await listDiffCommentsForSession(db, sessionId);
  set((state) => ({ diffComments: { ...state.diffComments, [sessionId]: notes } }));
  const rows = await listResolveThreads({ db, sessionId });
  const byNoteId = new Map(notes.map((note) => [note.id, note] as const));
  const live = new Set(
    (await listResolveQueueItems({ db, sessionId })).map((entry) => entry.item.threadId),
  );
  const rowsForNote = (noteId: string): ReadonlyArray<ResolveThread> =>
    rows.filter(
      (row) => (row.diffCommentId ?? noteIdOfThread({ threadId: row.threadId })) === noteId,
    );

  const latestGenerationOf = (
    candidates: ReadonlyArray<ResolveThread>,
  ): ResolveThread | undefined =>
    candidates.reduce<ResolveThread | undefined>(
      (best, row) => (best === undefined || row.generation > best.generation ? row : best),
      undefined,
    );

  let changed = 0;
  for (const note of notes) {
    if (!isOpenNote({ note })) {
      continue;
    }
    const current = latestGenerationOf(rowsForNote(note.id));
    const isReopen = current !== undefined && current.state === 'closed';
    const row: ResolveThread =
      current === undefined || isReopen
        ? createResolveThread({
            sessionId,
            threadId: noteThreadId({
              noteId: note.id,
              generation: current === undefined ? 0 : current.generation + 1,
            }),
            projectId: get().sessionActiveProject[sessionId] ?? null,
            diffCommentId: note.id,
            generation: current === undefined ? 0 : current.generation + 1,
            reopenedFromThreadId: current === undefined ? null : current.id,
          })
        : current;
    const isNewRow = current === undefined || isReopen;
    if (isNewRow && !(await saveResolveThread({ db, row, expectedRevision: null }))) {
      continue;
    }
    if (live.has(row.threadId)) {
      changed += isNewRow ? 1 : 0;
      continue;
    }
    await insertResolveQueueItem({
      db,
      item: newQueueItem({ sessionId, threadId: row.threadId, candidateRevision: row.revision }),
    });
    live.add(row.threadId);
    changed += 1;
  }
  const now = Date.now();
  for (const row of rows) {
    if (!isNoteGone({ row, notes: byNoteId })) {
      continue;
    }
    const closed = await upsertResolveThread({
      db,
      row: {
        ...row,
        state: 'closed',
        stage: 'resolved',
        closedAt: now,
        closedSource: 'goodboy',
        updatedAt: now,
      },
      expectedRevision: row.revision,
    });
    changed += closed ? 1 : 0;
  }
  if (changed === 0) {
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
  return changed;
};
