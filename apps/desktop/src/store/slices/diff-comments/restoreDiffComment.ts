import { restoreDiffComment as dbRestoreDiffComment } from '@goodboy/db';
import type { DiffComment } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly note: DiffComment;
};

export const restoreDiffComment = (set: SetFn, get: GetFn) => {
  return async ({ note }: Params): Promise<void> => {
    await dbRestoreDiffComment(tauriDatabase, note);
    await refreshNotes({ set, get, sessionId: note.sessionId });
  };
};
