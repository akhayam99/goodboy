import { insertDiffComment, listDiffCommentsForSession } from '@goodboy/db';
import type { DiffCommentAnchor, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

export function addDiffComment(set: SetFn) {
  return async (
    sessionId: SessionId,
    filePath: string,
    body: string,
    anchor?: DiffCommentAnchor,
  ) => {
    const id = crypto.randomUUID();
    await insertDiffComment(tauriDatabase, id, sessionId, filePath, body, anchor);
    const comments = await listDiffCommentsForSession(tauriDatabase, sessionId);
    set((state) => ({
      diffComments: { ...state.diffComments, [sessionId]: comments },
    }));
  };
}
