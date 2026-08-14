import type { StateTone } from '@goodboy/ui';
import type { BitbucketPullRequestState } from './client';

type Params = {
  readonly state: BitbucketPullRequestState;
};

export const pullRequestStateTone = ({ state }: Params): StateTone => {
  switch (state) {
    case 'OPEN':
      return 'success';
    case 'MERGED':
      return 'info';
    case 'DECLINED':
      return 'danger';
    case 'SUPERSEDED':
      return 'neutral';
    default: {
      const unreachable: never = state;
      return unreachable;
    }
  }
};
