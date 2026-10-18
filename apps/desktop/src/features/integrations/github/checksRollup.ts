import type { PrCheckConclusion, PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';

type ChecksGroup = 'failing' | 'running' | 'passed' | 'skipped';

type ChecksGroupRuns = {
  readonly group: ChecksGroup;
  readonly label: string;
  readonly runs: ReadonlyArray<PrCheckRun>;
};

const GROUP_ORDER: ReadonlyArray<ChecksGroup> = ['failing', 'running', 'passed', 'skipped'];

const GROUP_LABEL: Readonly<Record<ChecksGroup, string>> = {
  failing: 'Failing',
  running: 'Running',
  passed: 'Passed',
  skipped: 'Skipped',
};

type GroupParams = {
  readonly conclusion: PrCheckConclusion;
};

const groupOf = ({ conclusion }: GroupParams): ChecksGroup => {
  switch (conclusion) {
    case 'failure':
    case 'timed_out':
    case 'action_required':
    case 'cancelled':
      return 'failing';
    case 'pending':
    case 'unknown':
      return 'running';
    case 'success':
      return 'passed';
    case 'skipped':
    case 'neutral':
    case 'stale':
      return 'skipped';
    default: {
      const unexpectedConclusion: never = conclusion;
      return unexpectedConclusion;
    }
  }
};

type Params = {
  readonly checks: ReadonlyArray<PrCheckRun>;
};

export const checksGroupsOf = ({ checks }: Params): ReadonlyArray<ChecksGroupRuns> =>
  GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABEL[group],
    runs: checks.filter((check) => groupOf({ conclusion: check.conclusion }) === group),
  })).filter((entry) => entry.runs.length > 0);

export const checksRollup = ({ checks }: Params): string =>
  checksGroupsOf({ checks })
    .map((entry) => `${entry.runs.length} ${entry.label.toLowerCase()}`)
    .join(' · ');

export type ChecksCounts = {
  readonly failing: number;
  readonly running: number;
  readonly passed: number;
  readonly skipped: number;
};

export const checksCountsOf = ({ checks }: Params): ChecksCounts => {
  const sizeOf = (group: ChecksGroup): number =>
    checks.filter((check) => groupOf({ conclusion: check.conclusion }) === group).length;
  return {
    failing: sizeOf('failing'),
    running: sizeOf('running'),
    passed: sizeOf('passed'),
    skipped: sizeOf('skipped'),
  };
};

type RunsParams = {
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
};

export const checksRunsOf = ({ pr, detail }: RunsParams): ReadonlyArray<PrCheckRun> | null => {
  if (pr === null || pr.checksUnknown === true) {
    return null;
  }
  const matched = detail !== null && detail.prNumber === pr.number ? detail : null;
  if (matched === null || (matched.checksRead ?? 'ok') !== 'ok') {
    return null;
  }
  return matched.checks;
};

type WordParams = {
  readonly runs: ReadonlyArray<PrCheckRun> | null;
};

export const checksWordOf = ({ runs }: WordParams): string | null => {
  if (runs === null || runs.length === 0) {
    return null;
  }
  const counts = checksCountsOf({ checks: runs });
  if (counts.failing > 0) {
    return `${counts.failing} failing`;
  }
  if (counts.running > 0) {
    return `${counts.running} running`;
  }
  if (counts.passed > 0) {
    return `${counts.passed} passed`;
  }
  return counts.skipped > 0 ? `${counts.skipped} skipped` : null;
};
