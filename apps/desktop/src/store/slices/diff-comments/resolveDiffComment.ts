import {
  listDiffCommentsForSession,
  resolveDiffComment as dbResolveDiffComment,
} from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function resolveDiffComment(set: SetFn) {
  return async (sessionId: SessionId, commentId: string) => {
    await dbResolveDiffComment(tauriDatabase, commentId);
    const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
    set((state) => ({
      diffComments: { ...state.diffComments, [sessionId]: comments },
    }));
  };
}
