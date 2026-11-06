import type { WorkBranch } from '../../../../workBranchesOf';

type Params = {
  readonly branches: ReadonlyArray<WorkBranch>;
};

export const branchListLabelOf = ({ branches }: Params): string =>
  branches.map((branch) => `${branch.projectName} · ${branch.branch}`).join(', ');
