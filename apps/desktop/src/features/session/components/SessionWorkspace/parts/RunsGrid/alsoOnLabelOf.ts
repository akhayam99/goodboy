import type { WorkBranch } from '../../../../workBranchesOf';

type Params = {
  readonly branches: ReadonlyArray<WorkBranch>;
};

export const alsoOnLabelOf = ({ branches }: Params): string => {
  const [only] = branches;
  if (branches.length === 1 && only !== undefined) {
    return `Also on ${only.branch}`;
  }
  return `Also on ${branches.length} branches`;
};
