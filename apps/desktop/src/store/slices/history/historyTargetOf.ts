import type { MountId, SessionId } from '@goodboy/types';
import { resolveMountBaseBranch, selectMountById } from '../project-mounts/selectors';
import type { GetFn, HistoryTarget } from './types';
import { sessionById } from '../sessions/sessionIndex';
import { selectProjectById } from '../projects/selectProjectById';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const historyTargetOf = ({ get, sessionId, mountId }: Params): HistoryTarget => {
  const state = get();
  const mount = selectMountById({ state, sessionId, mountId });
  if (mount === null) {
    throw new Error('This branch is no longer in the session.');
  }
  if (mount.branch === '') {
    throw new Error('This folder has no branch to rewrite.');
  }
  const project = selectProjectById(state, mount.projectId);
  const session = sessionById(state.sessions, sessionId) ?? null;
  return {
    sessionId,
    mountId,
    projectId: mount.projectId,
    workspaceId: project?.workspaceId ?? session?.workspaceId ?? null,
    worktreePath: mount.worktreePath,
    branch: mount.branch,
    baseBranch: resolveMountBaseBranch({ mount, projects: state.projects }),
    projectName: project?.name ?? mount.mountName,
  };
};
