import { insertDiffComment, type DiffCommentAuthor, type DiffCommentTarget } from '@goodboy/db';
import type { DiffCommentAnchor, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectDisplayedMount } from '../project-mounts/selectors';
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
    const mount = selectDisplayedMount({ state: get(), sessionId });
    const target: DiffCommentTarget | undefined =
      mount === null ? undefined : { projectId: mount.projectId, branch: mount.branch };
    await insertDiffComment(tauriDatabase, id, sessionId, filePath, body, anchor, author, target);
    await refreshNotes({ set, get, sessionId });
  };
};
