import type { BranchOrigin } from '@goodboy/types';

type Params = {
  readonly isRepo: boolean;
  readonly adopted: boolean;
  readonly reused: boolean;
};

export const mountBranchOrigin = ({ isRepo, adopted, reused }: Params): BranchOrigin => {
  if (!isRepo) {
    return 'unknown';
  }
  return adopted || reused ? 'adopted' : 'created';
};
