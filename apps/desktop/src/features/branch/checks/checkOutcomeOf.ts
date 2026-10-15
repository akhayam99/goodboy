import type { PrCheckRun } from '@goodboy/types';

export type CheckOutcome = 'running' | 'passed' | 'failed';

type Params = {
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly name: string | null;
  readonly analyzedUrl: string;
};

const PASSED = ['success', 'neutral', 'skipped'];
const FAILED = ['failure', 'timed_out', 'cancelled', 'action_required'];

export const checkOutcomeOf = ({ checks, name, analyzedUrl }: Params): CheckOutcome => {
  const run = name === null ? undefined : checks.find((check) => check.name === name);
  if (run === undefined || run.detailsUrl === analyzedUrl) {
    return 'running';
  }
  if (PASSED.includes(run.conclusion)) {
    return 'passed';
  }
  if (FAILED.includes(run.conclusion)) {
    return 'failed';
  }
  return 'running';
};
