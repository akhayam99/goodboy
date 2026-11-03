import { PULL_REQUEST_NOUNS } from '@goodboy/core/review-source';
import type { PullRequestHost } from '@goodboy/types';

type Params = {
  readonly host: PullRequestHost;
  readonly number: number;
};

export const pullRequestNumberLabel = ({ host, number }: Params): string => {
  const nouns = PULL_REQUEST_NOUNS[host];
  return host === 'github'
    ? `${nouns.numberPrefix}${number}`
    : `${nouns.short} ${nouns.numberPrefix}${number}`;
};
