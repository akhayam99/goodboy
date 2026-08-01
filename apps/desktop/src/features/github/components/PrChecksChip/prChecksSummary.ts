import type { PrCheckRun } from '@goodboy/types';

export type PrChecksState = 'success' | 'failure' | 'pending' | 'none';

type Params = {
  readonly checks: ReadonlyArray<PrCheckRun>;
};

export const prChecksSummary = ({ checks }: Params): PrChecksState => {
  if (checks.length === 0) {
    return 'none';
  }
  const failed = checks.some(
    (check) =>
      check.conclusion === 'failure' ||
      check.conclusion === 'cancelled' ||
      check.conclusion === 'timed_out',
  );
  if (failed) {
    return 'failure';
  }
  if (checks.some((check) => check.conclusion === 'pending')) {
    return 'pending';
  }
  if (checks.some((check) => check.conclusion === 'success')) {
    return 'success';
  }
  return 'none';
};
