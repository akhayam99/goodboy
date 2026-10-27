import { formatError } from '@goodboy/ui';
import type { ProjectId, PullRequestState, WorkspaceId } from '@goodboy/types';
import { refreshWorktreeStatuses } from '../../runtime/worktreeStatuses/cache';
import { worktreeSyncBranchRef, type BranchRefSync } from '../../../features/worktree/worktree';

type Params = {
  readonly cwd: string;
  readonly branch: string;
  readonly pr: PullRequestState | null;
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId;
};

const UNCHANGED: BranchRefSync = { kind: 'unchanged' };

const SETTLED_STATES: ReadonlyArray<PullRequestState['state']> = ['merged', 'closed'];

export const syncBranchRefToPr = async ({
  cwd,
  branch,
  pr,
  workspaceId,
  projectId,
}: Params): Promise<BranchRefSync> => {
  if (pr === null || pr.headBranch !== branch || SETTLED_STATES.includes(pr.state)) {
    return UNCHANGED;
  }
  const expectedSha = pr.headSha ?? null;
  if (expectedSha === null || expectedSha === '') {
    return UNCHANGED;
  }
  try {
    const outcome = await worktreeSyncBranchRef({
      worktreePath: cwd,
      branch,
      expectedSha,
      workspaceId,
      projectId,
    });
    if (outcome.kind === 'updated') {
      await refreshWorktreeStatuses({ worktreePaths: [cwd] });
    }
    return outcome;
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
};
