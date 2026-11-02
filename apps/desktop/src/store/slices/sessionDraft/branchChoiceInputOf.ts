import type { ProjectId } from '@goodboy/types';
import type { DraftBranchChoice } from './state';

type Params = {
  readonly choice: DraftBranchChoice | null;
  readonly projectId: ProjectId | null;
};

export type BranchChoiceInput = {
  readonly existingBranch?: string;
  readonly existingWorktreePath?: string;
  readonly isGoalBranchIgnored?: boolean;
};

export const branchChoiceInputOf = ({ choice, projectId }: Params): BranchChoiceInput => {
  if (choice === null || choice.projectId !== projectId) {
    return {};
  }
  switch (choice.pick.kind) {
    case 'branch':
      return { existingBranch: choice.pick.branch };
    case 'worktree':
      return {
        existingBranch: choice.pick.branch,
        existingWorktreePath: choice.pick.worktreePath,
      };
    case 'new-branch':
      return { isGoalBranchIgnored: true };
    default: {
      const unreachable: never = choice.pick;
      return unreachable;
    }
  }
};
