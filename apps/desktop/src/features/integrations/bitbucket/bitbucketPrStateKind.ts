import type { PullRequestStateKind } from '@goodboy/types';
import type { BitbucketPullRequestState } from './client';

type Params = {
  readonly state: BitbucketPullRequestState;
};

export const BITBUCKET_PR_STATE_KIND = {
  OPEN: 'open',
  MERGED: 'merged',
  DECLINED: 'closed',
  SUPERSEDED: 'closed',
} satisfies Record<BitbucketPullRequestState, PullRequestStateKind>;

const KIND_BY_RAW_STATE: Readonly<Record<string, PullRequestStateKind>> = BITBUCKET_PR_STATE_KIND;

export const bitbucketPrStateKind = ({ state }: Params): PullRequestStateKind =>
  KIND_BY_RAW_STATE[state] ?? 'open';
