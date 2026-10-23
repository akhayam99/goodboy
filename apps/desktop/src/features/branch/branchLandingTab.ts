import type { BranchTab } from '../../store/slices/navigation/types';

type Params = {
  readonly deepLink: BranchTab | null;
};

export const branchLandingTabOf = ({ deepLink }: Params): BranchTab => deepLink ?? 'pr';
