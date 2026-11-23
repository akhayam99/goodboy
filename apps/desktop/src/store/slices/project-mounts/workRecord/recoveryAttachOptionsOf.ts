import type { MountPullRequestProvider } from '@goodboy/types';

type Params = {
  readonly provider: MountPullRequestProvider;
  readonly prNumber: number;
};

type RecoveryAttachOptions = {
  readonly canFetchRemote: true;
  readonly fallbackRef?: string;
};

const fallbackRefOf = ({ provider, prNumber }: Params): string | undefined => {
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

export const recoveryAttachOptionsOf = ({ provider, prNumber }: Params): RecoveryAttachOptions => {
  const fallbackRef = fallbackRefOf({ provider, prNumber });
  return fallbackRef === undefined
    ? { canFetchRemote: true }
    : { canFetchRemote: true, fallbackRef };
};
