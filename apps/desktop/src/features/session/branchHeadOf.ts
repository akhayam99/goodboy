import type { BranchGroupHead } from './branchGroupsOf';

type Params = {
  readonly head: BranchGroupHead;
};

export const branchHeadLabelOf = ({ head }: Params): string => {
  switch (head.kind) {
    case 'branch':
      return head.branch.branch;
    case 'series':
      return head.name;
    case 'none':
      return 'No branch';
    default: {
      const unreachable: never = head;
      return unreachable;
    }
  }
};

export const branchHeadMarkOf = ({ head }: Params): string | null => {
  switch (head.kind) {
    case 'branch':
      return head.branch.projectName;
    case 'series':
      return head.projectName;
    case 'none':
      return null;
    default: {
      const unreachable: never = head;
      return unreachable;
    }
  }
};
