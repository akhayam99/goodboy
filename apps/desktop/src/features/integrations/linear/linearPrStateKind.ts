import type { PullRequestStateKind } from '@goodboy/types';

type Params = {
  readonly status: string | null;
};

export const linearPrStateKind = ({ status }: Params): PullRequestStateKind | null => {
  switch (status?.toLowerCase()) {
    case 'merged':
      return 'merged';
    case 'closed':
      return 'closed';
    case 'draft':
      return 'draft';
    case 'open':
      return 'open';
    default:
      return null;
  }
};
