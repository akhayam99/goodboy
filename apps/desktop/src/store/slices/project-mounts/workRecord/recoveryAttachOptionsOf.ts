import type { MountPullRequestProvider } from '@goodboy/types';
import { fallbackRefOf } from './fallbackRefOf';

type Params = {
  readonly provider: MountPullRequestProvider;
  readonly prNumber: number;
};

type RecoveryAttachOptions = {
  readonly canFetchRemote: true;
  readonly fallbackRef?: string;
};

export const recoveryAttachOptionsOf = ({ provider, prNumber }: Params): RecoveryAttachOptions => {
  const fallbackRef = fallbackRefOf({ provider, prNumber });
  return fallbackRef === undefined
    ? { canFetchRemote: true }
    : { canFetchRemote: true, fallbackRef };
};
