import type { MountPullRequestLink, MountPullRequestProvider } from '@goodboy/types';
import { fallbackRefOf } from './fallbackRefOf';

type Params = {
  readonly link: MountPullRequestLink | null;
};

type FetchableRequest = {
  readonly provider: MountPullRequestProvider;
  readonly prNumber: number;
};

export const fetchableRequestOf = ({ link }: Params): FetchableRequest | null => {
  if (link === null || (link.state !== 'open' && link.state !== 'draft')) {
    return null;
  }
  const request = { provider: link.provider, prNumber: link.prNumber };
  return fallbackRefOf(request) === undefined ? null : request;
};
