import type { MountPullRequestProvider } from '@goodboy/types';

type Params = {
  readonly provider: MountPullRequestProvider;
  readonly prNumber: number;
};

export const fallbackRefOf = ({ provider, prNumber }: Params): string | undefined => {
  switch (provider) {
    case 'github':
      return `pull/${prNumber}/head`;
    case 'gitlab':
      return `merge-requests/${prNumber}/head`;
    case 'bitbucket':
      return undefined;
    default: {
      const exhaustive: never = provider;
      return exhaustive;
    }
  }
};
