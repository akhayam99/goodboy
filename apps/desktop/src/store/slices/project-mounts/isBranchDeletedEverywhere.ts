import { refreshRemoteRefs } from './refreshRemoteRefs';
import { listBranchNames, listRemoteBranches } from '../../../features/worktree/worktree';

type Params = {
  readonly repoRoot: string;
  readonly branch: string;
};

export const isBranchDeletedEverywhere = async ({ repoRoot, branch }: Params): Promise<boolean> => {
  const local = await listBranchNames({ repoPath: repoRoot });
  if (local.includes(branch)) {
    return false;
  }
  const isRefreshed = await refreshRemoteRefs({ repoRoot });
  if (!isRefreshed) {
    return false;
  }
  const remote = await listRemoteBranches(repoRoot);
  return !remote.some((candidate) => candidate.name === branch);
};
