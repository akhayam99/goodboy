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
  let changed = 0;
  for (const note of notes) {
    if (!isOpenNote({ note })) {
      continue;
    }
    const threadId = noteThreadId({ noteId: note.id });
    const previous = rows.find((row) => row.threadId === threadId);
    if (previous !== undefined && previous.state === 'closed') {
      const reopened = await saveResolveThread({
        db,
        row: {
          ...previous,
          state: 'open',
          stage: 'new',
          stateReason: null,
          closedAt: null,
          closedSource: null,
          updatedAt: Date.now(),
        },
        expectedRevision: previous.revision,
      });
      changed += reopened ? 1 : 0;
    }
    const row =
      previous ??
      createResolveThread({
        sessionId,
        threadId,
        projectId: get().sessionActiveProject[sessionId] ?? null,
        diffCommentId: note.id,
      });
    if (previous === undefined && !(await saveResolveThread({ db, row, expectedRevision: null }))) {
      continue;
    }
    if (live.has(threadId)) {
      changed += previous === undefined ? 1 : 0;
      continue;
    }
    await insertResolveQueueItem({
      db,
      item: newQueueItem({ sessionId, threadId, candidateRevision: row.revision }),
    });
    live.add(threadId);
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
