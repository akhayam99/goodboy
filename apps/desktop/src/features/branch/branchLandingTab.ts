import type { BranchTab } from '../../store/slices/navigation/types';
import { isBranchTabAvailable } from './branchTabs';

type Params = {
  readonly hasPullRequest: boolean;
  readonly deepLink: BranchTab | null;
};

export const branchLandingTabOf = ({ hasPullRequest, deepLink }: Params): BranchTab => {
  if (deepLink !== null) {
    return deepLink;
  }
  return hasPullRequest && isBranchTabAvailable('pr') ? 'pr' : 'comments';
};
