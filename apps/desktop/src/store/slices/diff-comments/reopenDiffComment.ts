import { listDiffCommentsForSession, reopenDiffComment as dbReopenDiffComment } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export const reopenDiffComment = (set: SetFn) => {
  return async (sessionId: SessionId, commentId: string) => {
    await dbReopenDiffComment(tauriDatabase, commentId);
    const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
    set((state) => ({
      diffComments: { ...state.diffComments, [sessionId]: comments },
    }));
  };
};
