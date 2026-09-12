import type { IsoDateTime, SessionId, SessionMountView, SessionProjectMount } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionMounts'>;
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount;
};

export const mountViewPatch = ({
  state,
  sessionId,
  mount,
}: Params): Partial<Pick<AppState, 'sessionMounts'>> => {
  const views = state.sessionMounts[sessionId];
  if (views === undefined || views.some((view) => view.id === mount.mountId)) {
    return {};
  }
  const timestamp = new Date().toISOString() as IsoDateTime;
  const view: SessionMountView = {
    id: mount.mountId,
    sessionId,
    projectId: mount.projectId,
    worktreePath: mount.worktreePath,
    lastWorktreePath: mount.lastWorktreePath,
    branch: mount.branch,
    baseBranch: mount.baseBranch,
    parallelIndex: mount.parallelIndex,
    mountName: mount.mountName,
    repoSlug: null,
    repoRoot: mount.repoRoot,
    isAttached: mount.isAttached,
    diskState: mount.diskState,
    revision: mount.revision,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { sessionMounts: { ...state.sessionMounts, [sessionId]: [...views, view] } };
};
