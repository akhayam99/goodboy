import type { PrCheckConclusion, PrCheckRun, PrDetail, PullRequestState } from '@goodboy/types';

type ChecksGroup = 'failing' | 'running' | 'passed' | 'skipped';

type ChecksGroupRuns = {
  readonly group: ChecksGroup;
  readonly label: string;
  readonly runs: ReadonlyArray<PrCheckRun>;
};

export type ChecksWord = 'unknown' | 'none' | 'pending' | 'failing' | 'passing';

const GROUP_ORDER: ReadonlyArray<ChecksGroup> = ['failing', 'running', 'passed', 'skipped'];

const GROUP_LABEL: Readonly<Record<ChecksGroup, string>> = {
  failing: 'Failing',
  running: 'Running',
  passed: 'Passed',
  skipped: 'Skipped',
};

const ROLLUP_SEPARATOR = ' · ';

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
    .join(ROLLUP_SEPARATOR);

type WordParams = {
  readonly pr: PullRequestState | null;
  readonly detail: PrDetail | null;
};

export const checksWordOf = ({ pr, detail }: WordParams): ChecksWord => {
  if (pr === null) {
    return 'none';
  }
  const matched = detail !== null && detail.prNumber === pr.number ? detail : null;
  const read = matched?.checksRead ?? 'ok';
  if (pr.checksUnknown === true || read !== 'ok') {
    return 'unknown';
  }
  if (matched !== null && matched.checks.length > 0) {
    const groups = checksGroupsOf({ checks: matched.checks }).map((entry) => entry.group);
    if (groups.includes('failing')) {
      return 'failing';
    }
    return groups.includes('running') ? 'pending' : 'passing';
  }
  if (pr.checks === 'failure') {
    return 'failing';
  }
  if (pr.checks === 'pending') {
    return 'pending';
  }
  return pr.checks === 'success' ? 'passing' : 'none';
};
