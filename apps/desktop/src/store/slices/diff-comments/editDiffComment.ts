import { updateDiffCommentBody } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

export const editDiffComment = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, commentId: string, body: string) => {
    await updateDiffCommentBody({ db: tauriDatabase, id: commentId, body });
    await refreshNotes({ set, get, sessionId });
  };
};
