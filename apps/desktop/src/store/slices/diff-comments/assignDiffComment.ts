import { assignDiffCommentTarget } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectActiveMount } from '../project-mounts/selectors';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

export const assignDiffComment = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, commentId: string) => {
    const mount = selectActiveMount({ state: get(), sessionId });
    if (mount === null) {
      return;
    }
    await assignDiffCommentTarget(tauriDatabase, commentId, {
      projectId: mount.projectId,
      branch: mount.branch,
    });
    await refreshNotes({ set, get, sessionId });
  };
};
