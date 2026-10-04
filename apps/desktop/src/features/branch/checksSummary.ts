import type { PrCheckRun, PullRequestChecks } from '@goodboy/types';

export type ChecksSummary = {
  readonly tone: 'success' | 'danger' | 'muted';
  readonly label: string;
};

type Params = {
  readonly rollup: PullRequestChecks;
  readonly checks: ReadonlyArray<PrCheckRun>;
};

const FAILED = new Set(['failure', 'timed_out']);

const plural = ({ count, one, many }: { count: number; one: string; many: string }): string =>
  `${count} ${count === 1 ? one : many}`;

export const checksSummaryOf = ({ rollup, checks }: Params): ChecksSummary | null => {
  const failed = checks.filter((check) => FAILED.has(check.conclusion)).length;
  const running = checks.filter((check) => check.conclusion === 'pending').length;
  if (failed > 0 || rollup === 'failure') {
    return { tone: 'danger', label: `${Math.max(failed, 1)} failing` };
  }
  if (running > 0 || rollup === 'pending') {
    return { tone: 'muted', label: `${Math.max(running, 1)} running` };
  }
  if (rollup === 'success') {
    return {
      tone: 'success',
      label:
        checks.length === 0
          ? 'checks passed'
          : plural({ count: checks.length, one: 'check', many: 'checks' }),
    };
  }
  return null;
};
