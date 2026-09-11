import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { updateSessionActiveProject } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { findMountById } from '../project-mounts/findMountById';
import { recoverSoleMount } from '../project-mounts/recoverSoleMount';
import { selectActiveMountId, selectProjectMounts } from '../project-mounts/selectors';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Input = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly mountId?: MountId;
};

export const setSessionActiveProject = ({ set, get }: Params) => {
  return async ({ sessionId, projectId, mountId: requested }: Input): Promise<void> => {
    const state = get();
    const candidates = selectProjectMounts({ state, sessionId, projectId });
    const target =
      findMountById({ mounts: candidates, mountId: requested }) ??
      findMountById({ mounts: candidates, mountId: selectActiveMountId({ state, sessionId }) }) ??
      recoverSoleMount({ mounts: candidates });
    if (target !== null) {
      await get().setSessionActiveMount({ sessionId, mountId: target.mountId });
      return;
    }
    set((current) => ({
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, activeProjectId: projectId } : session,
      ),
      sessionActiveProject: { ...current.sessionActiveProject, [sessionId]: projectId },
    }));
    await updateSessionActiveProject({ db: tauriDatabase, id: sessionId, projectId });
  };
};
