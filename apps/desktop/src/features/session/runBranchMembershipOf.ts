import type { SessionRun } from './sessionRunsOf';
import type { WorkBranch } from './workBranchesOf';

type Params = {
  readonly run: SessionRun;
};

export const runBranchMembershipOf = ({ run }: Params): ReadonlyArray<WorkBranch> => [
  ...run.branches,
  ...run.goneBranches,
];
