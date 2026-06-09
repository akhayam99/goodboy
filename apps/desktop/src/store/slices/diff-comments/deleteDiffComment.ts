import { deleteDiffComment as dbDeleteDiffComment, listDiffCommentsForSession } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const deleteDiffComment = (set: SetFn) => {
  return async (sessionId: SessionId, commentId: string) => {
    await dbDeleteDiffComment(tauriDatabase, commentId);
    const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
    set((state) => ({
      diffComments: { ...state.diffComments, [sessionId]: comments },
    }));
  };
};
