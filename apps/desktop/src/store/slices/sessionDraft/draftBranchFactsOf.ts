import { branchNamedInGoal } from '../sessions/branchNamedInGoal';
import type { DraftBranchChoice } from './state';

type Params = {
  readonly goal: string;
  readonly branches: ReadonlyArray<string>;
  readonly baseBranch: string | null;
  readonly choice: DraftBranchChoice['pick'] | null;
};

export type DraftBranchFacts = {
  readonly branch: string | null;
  readonly isExistingBranch: boolean;
  readonly isNamedByGoal: boolean;
  readonly goalBranches: ReadonlyArray<string>;
};

export const draftBranchFactsOf = ({
  goal,
  branches,
  baseBranch,
  choice,
}: Params): DraftBranchFacts | null => {
  if (choice !== null) {
    return choice.kind === 'new-branch'
      ? null
      : { branch: choice.branch, isExistingBranch: true, isNamedByGoal: false, goalBranches: [] };
  }
  const match = branchNamedInGoal({ goal, branches, baseBranch });
  if (match.kind === 'none') {
    return null;
  }
  if (match.kind === 'one') {
    return {
      branch: match.branch,
      isExistingBranch: true,
      isNamedByGoal: true,
      goalBranches: [],
    };
  }
  return {
    branch: null,
    isExistingBranch: false,
    isNamedByGoal: false,
    goalBranches: match.branches,
  };
};
