import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import type { PullRequestHost } from '@goodboy/types';

type Params = {
  readonly host: PullRequestHost;
};

export const requestNounLabel = ({ host }: Params): string => {
  const noun = PULL_REQUEST_NOUNS[host].long;
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
};
