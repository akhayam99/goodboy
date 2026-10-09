import type { PrCheckRun } from '@goodboy/types';
import { bitbucketCheckConclusion } from './bitbucketCheckConclusion';
import type { BitbucketPortStatus } from './bitbucketPullRequestTypes';

type Params = {
  readonly statuses: ReadonlyArray<BitbucketPortStatus>;
};

type DurationParams = {
  readonly status: BitbucketPortStatus;
};

const durationMs = ({ status }: DurationParams): number | null => {
  const startedAt = Date.parse(status.createdOn);
  const endedAt = Date.parse(status.updatedOn);
  if (Number.isNaN(startedAt) || Number.isNaN(endedAt) || endedAt < startedAt) {
    return null;
  }
  return endedAt - startedAt;
};

export const bitbucketCheckRuns = ({ statuses }: Params): ReadonlyArray<PrCheckRun> =>
  statuses.map((status) => ({
    name: status.name !== '' ? status.name : status.key,
    conclusion: bitbucketCheckConclusion({ state: status.state }),
    detailsUrl: status.url,
    durationMs: durationMs({ status }),
  }));
