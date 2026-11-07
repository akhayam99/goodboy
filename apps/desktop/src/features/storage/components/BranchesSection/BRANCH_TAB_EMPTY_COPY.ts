import type { BranchTab } from '../../branches/classifyBranch';

export const BRANCH_TAB_EMPTY_COPY = {
  safe: 'Nothing safe to delete here. Choose All to see the rest.',
  'needs-look': 'No branch needs a look.',
  all: 'No branch here.',
} as const satisfies Record<BranchTab, string>;
