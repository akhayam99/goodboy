import { insertDiffComment, type DiffCommentAuthor } from '@goodboy/db';
import type { DiffCommentAnchor, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

export const addDiffComment = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    filePath: string,
    body: string,
    anchor?: DiffCommentAnchor,
    author?: DiffCommentAuthor,
  ) => {
    const id = crypto.randomUUID();
    await insertDiffComment(tauriDatabase, id, sessionId, filePath, body, anchor, author);
    await refreshNotes({ set, get, sessionId });
  };
};
