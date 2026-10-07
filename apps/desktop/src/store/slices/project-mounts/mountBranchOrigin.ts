import type { BranchOrigin } from '@goodboy/types';

type Params = {
  readonly isRepo: boolean;
  readonly adopted: boolean;
  readonly reused: boolean;
  readonly trackedRemote?: boolean;
};

export const mountBranchOrigin = ({
  isRepo,
  adopted,
  reused,
  trackedRemote = false,
}: Params): BranchOrigin => {
  if (!isRepo) {
    return 'unknown';
  }
  return adopted || reused || trackedRemote ? 'adopted' : 'created';
};
