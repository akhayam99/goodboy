import { deleteDiffComment as dbDeleteDiffComment, restoreDiffComment } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly ids: ReadonlyArray<string>;
};

export const discardDiffComments = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, ids }: Params): Promise<void> => {
    const wanted = new Set(ids);
    const notes = (get().diffComments[sessionId] ?? []).filter((note) => wanted.has(note.id));
    if (notes.length === 0) {
      return;
    }
    for (const note of notes) {
      await dbDeleteDiffComment(tauriDatabase, note.id);
    }
    await refreshNotes({ set, get, sessionId });
    get().undoable({
      message: notes.length === 1 ? 'Note discarded' : `${notes.length} notes discarded`,
      conflictMessage: 'This note changed. Nothing changed.',
      undo: async () => {
        const present = new Set((get().diffComments[sessionId] ?? []).map((note) => note.id));
        for (const note of notes) {
          if (!present.has(note.id)) {
            await restoreDiffComment(tauriDatabase, note);
          }
        }
        await refreshNotes({ set, get, sessionId });
        return true;
      },
    });
  };
};
