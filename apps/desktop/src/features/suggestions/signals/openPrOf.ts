import type { PullRequestState } from '@goodboy/types';

type Params = {
  readonly pr: PullRequestState | null;
};

export const openPrOf = ({ pr }: Params): PullRequestState | null =>
  pr === null || pr.state === 'merged' || pr.state === 'closed' ? null : pr;
