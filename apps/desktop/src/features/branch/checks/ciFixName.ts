import type { PrCheckRun, PullRequestState, PullRequestView } from '@goodboy/types';

type Params = {
  readonly check: PrCheckRun | undefined;
  readonly pullRequest: PullRequestState | PullRequestView;
};

export const ciFixName = ({ check, pullRequest }: Params): string =>
  check === undefined
    ? `CI fix · #${pullRequest.number}`
    : `CI fix · ${check.name} · #${pullRequest.number}`;
