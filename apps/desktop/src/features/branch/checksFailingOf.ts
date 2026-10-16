import type { PrCheckRun, PullRequestChecks } from '@goodboy/types';

type Params = {
  readonly rollup: PullRequestChecks;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const FAILED = new Set(['failure', 'timed_out']);

export const checksFailingOf = ({ rollup, checks }: Params): number => {
  const failed = checks.filter((check) => FAILED.has(check.conclusion)).length;
  if (failed > 0) {
    return failed;
  }
  return rollup === 'failure' ? 1 : 0;
};
