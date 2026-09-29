import type { PullRequestStateKind } from '@goodboy/types';
import type { BitbucketPullRequestState } from './client';

const BITBUCKET_PR_STATE_KIND = {
  OPEN: 'open',
  MERGED: 'merged',
  DECLINED: 'closed',
  SUPERSEDED: 'closed',
} as const satisfies Record<BitbucketPullRequestState, PullRequestStateKind>;

type Params = {
  readonly state: string;
};

export const bitbucketPrStateKind = ({ state }: Params): PullRequestStateKind =>
  BITBUCKET_PR_STATE_KIND[state as BitbucketPullRequestState] ?? 'open';
