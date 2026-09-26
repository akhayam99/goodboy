import { resolveDiffComment as dbResolveDiffComment } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

export const resolveDiffComment = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, commentId: string) => {
    await dbResolveDiffComment(tauriDatabase, commentId);
    await refreshNotes({ set, get, sessionId });
  };
};
