import type { SessionMountView, SessionProjectMount } from '@goodboy/types';

type Params = {
  readonly view: SessionMountView;
  readonly worktreePath?: string;
};

export const aProjectMountOf = ({ view, worktreePath }: Params): SessionProjectMount => ({
  mountId: view.id,
  sessionId: view.sessionId,
  projectId: view.projectId,
  mountName: view.mountName,
  worktreePath: worktreePath ?? view.worktreePath ?? `/work/${view.mountName}`,
  lastWorktreePath: view.lastWorktreePath,
  repoRoot: view.repoRoot,
  branch: view.branch,
  baseBranch: view.baseBranch,
  parallelIndex: view.parallelIndex,
  isAttached: view.isAttached,
  diskState: view.diskState,
  revision: view.revision,
});
