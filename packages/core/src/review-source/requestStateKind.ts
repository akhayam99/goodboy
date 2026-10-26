import type { PullRequestStateKind, RequestStateName } from '@goodboy/types';

export const REQUEST_STATE_KIND = {
  open: 'open',
  merged: 'merged',
  closed: 'closed',
  draft: 'draft',
  unknown: 'open',
} as const satisfies Readonly<Record<RequestStateName, PullRequestStateKind>>;

type Params = {
  readonly requestState: RequestStateName;
};

export const requestStateKind = ({ requestState }: Params): PullRequestStateKind =>
  REQUEST_STATE_KIND[requestState];
