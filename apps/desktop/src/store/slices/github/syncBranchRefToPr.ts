import type { ProjectId, PullRequestState, WorkspaceId } from '@goodboy/types';
import { refreshWorktreeStatuses } from '../worktreeStatuses/cache';
import { worktreeSyncBranchRef } from '../../../features/worktree/worktree';

type Params = {
  readonly cwd: string;
  readonly branch: string;
  readonly pr: PullRequestState | null;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
};

const SETTLED_STATES: ReadonlyArray<PullRequestState['state']> = ['merged', 'closed'];

export const syncBranchRefToPr = async ({
  cwd,
  branch,
  pr,
  workspaceId,
  projectId,
}: Params): Promise<boolean> => {
  if (pr === null || pr.headBranch !== branch || SETTLED_STATES.includes(pr.state)) {
    return false;
  }
  const expectedSha = pr.headSha ?? null;
  if (expectedSha === null || expectedSha === '') {
    return false;
  }
  try {
    const hasMoved = await worktreeSyncBranchRef({
      worktreePath: cwd,
      branch,
      expectedSha,
      workspaceId,
      projectId,
    });
    if (!hasMoved) {
      return false;
    }
    await refreshWorktreeStatuses({ worktreePaths: [cwd] });
    return true;
  } catch {
    return false;
  }
};
