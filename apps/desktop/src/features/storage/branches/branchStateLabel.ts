import type { ProjectBranch } from '../../worktree/branchCleanup';
import { verdictCopy } from './branchCopy';

type Params = {
  readonly branch: ProjectBranch;
  readonly base: string;
};

export const branchStateLabel = ({ branch, base }: Params): string => {
  const verdict = verdictCopy({ branch, base });
  if (!verdict.isSafe) {
    return verdict.label;
  }
  return branch.mergeState.kind === 'no-own-commits' ? 'No commits' : 'Merged';
};
