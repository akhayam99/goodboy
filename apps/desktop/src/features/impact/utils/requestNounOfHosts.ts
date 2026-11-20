import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import type { PullRequestHost } from '@goodboy/types';

type Params = {
  readonly hosts: ReadonlyArray<PullRequestHost>;
};

export const requestNounOfHosts = ({ hosts }: Params): string => {
  const distinct = [...new Set(hosts)];
  if (distinct.length > 1) {
    return 'requests';
  }
  return `${PULL_REQUEST_NOUNS[distinct[0] ?? 'github'].long}s`;
};
