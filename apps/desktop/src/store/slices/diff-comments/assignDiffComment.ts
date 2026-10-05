import { assignDiffCommentTarget } from '@goodboy/db';
import type { MountId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectActiveMount, selectMountById } from '../project-mounts/selectors';
import { refreshNotes } from './refreshNotes';
import type { GetFn, SetFn } from './types';

export const assignDiffComment = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, commentId: string, mountId?: MountId) => {
    const mount =
      mountId === undefined
        ? selectActiveMount({ state: get(), sessionId })
        : selectMountById({ state: get(), sessionId, mountId });
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
