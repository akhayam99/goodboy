import type { MountId, SessionId } from '@goodboy/types';
import { selectMountById } from '../project-mounts/selectors';
import type { GetFn, HistoryTarget } from './types';

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
  const project = state.projects.find((candidate) => candidate.id === mount.projectId) ?? null;
  const session = state.sessions.find((candidate) => candidate.id === sessionId) ?? null;
  return {
    sessionId,
    mountId,
    projectId: mount.projectId,
    workspaceId: project?.workspaceId ?? session?.workspaceId ?? null,
    worktreePath: mount.worktreePath,
    branch: mount.branch,
    baseBranch: mount.baseBranch ?? project?.baseBranch ?? 'main',
    projectName: project?.name ?? mount.mountName,
  };
};
