import type { PrCheckConclusion } from '@goodboy/types';
import type { BitbucketStatusState } from './client';

type Params = {
  readonly state: BitbucketStatusState;
};

export const bitbucketCheckConclusion = ({ state }: Params): PrCheckConclusion => {
  switch (state) {
    case 'SUCCESSFUL':
      return 'success';
    case 'FAILED':
      return 'failure';
    case 'INPROGRESS':
      return 'pending';
    case 'STOPPED':
      return 'cancelled';
    default: {
      const unexpectedState: never = state;
      return unexpectedState;
    }
  }
};
