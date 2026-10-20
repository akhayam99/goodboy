import type { ChecksNotRunReason, ResultCheck, ResultChecksRun } from './result';

export const AUTO_CHECK_TIMEOUT_MS = 5 * 60_000;

export type CheckReport = Readonly<{
  name: string;
  status: 'pass' | 'fail' | 'unknown' | 'timed_out';
}>;

export type ChecksVerdict = Readonly<{
  checks: ReadonlyArray<ResultCheck>;
  run: ResultChecksRun;
}>;

export type ChecksVerdictParams = Readonly<{
  reports: ReadonlyArray<CheckReport>;
  commit: string | null;
}>;

export type NotCheckedParams = Readonly<{
  reason: ChecksNotRunReason;
  commit: string | null;
}>;

export const notCheckedOf = ({ reason, commit }: NotCheckedParams): ChecksVerdict => ({
  checks: [],
  run: { verdict: 'not_checked', reason, commit },
});

export const checksVerdictOf = ({ reports, commit }: ChecksVerdictParams): ChecksVerdict => {
  if (reports.length === 0) {
    return notCheckedOf({ reason: 'none_ticked', commit });
  }
  const checks = reports.map((report): ResultCheck => ({
    name: report.name,
    status: report.status === 'pass' || report.status === 'fail' ? report.status : 'unknown',
    source: 'harness',
  }));
  if (reports.some((report) => report.status === 'fail')) {
    return { checks, run: { verdict: 'red', reason: null, commit } };
  }
  if (reports.some((report) => report.status === 'timed_out')) {
    return { checks, run: { verdict: 'not_checked', reason: 'timed_out', commit } };
  }
  if (reports.some((report) => report.status === 'unknown')) {
    return { checks, run: { verdict: 'not_checked', reason: 'not_available', commit } };
  }
  return { checks, run: { verdict: 'green', reason: null, commit } };
};

const NOT_CHECKED_TEXT = {
  none_ticked: 'no scripts are ticked as Auto checks',
  timed_out: 'timed out',
  tree_moved: 'the tree changed while the checks ran',
  tree_dirty: 'the tree has uncommitted changes',
  not_available: 'the checks could not run',
} satisfies Record<ChecksNotRunReason, string>;

export type ChecksTextParams = Readonly<{
  run: ResultChecksRun;
  checks: ReadonlyArray<ResultCheck>;
}>;

type NamesParams = {
  readonly checks: ReadonlyArray<ResultCheck>;
  readonly status: ResultCheck['status'];
};

const namesOf = ({ checks, status }: NamesParams): string =>
  checks
    .filter((check) => check.status === status)
    .map((check) => check.name)
    .join(', ');

export const checksTextOf = ({ run, checks }: ChecksTextParams): string => {
  if (run.verdict === 'green') {
    return `Checks green: ${namesOf({ checks, status: 'pass' })}`;
  }
  if (run.verdict === 'red') {
    return `Checks red: ${namesOf({ checks, status: 'fail' })}`;
  }
  const reason = run.reason ?? 'not_available';
  return `Not checked: ${NOT_CHECKED_TEXT[reason]}`;
};

export type CanRerunParams = Readonly<{
  run: ResultChecksRun;
}>;

export const canRerunChecks = ({ run }: CanRerunParams): boolean =>
  run.commit !== null && run.reason !== 'none_ticked' && run.reason !== 'tree_dirty';

type RecordValue = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const REASONS: ReadonlyArray<ChecksNotRunReason> = [
  'none_ticked',
  'timed_out',
  'tree_moved',
  'tree_dirty',
  'not_available',
];

export type ChecksRunOfParams = Readonly<{
  result: unknown;
}>;

export const checksRunOfResult = ({ result }: ChecksRunOfParams): ResultChecksRun | null => {
  if (!isRecord(result) || !isRecord(result['verified'])) {
    return null;
  }
  const run = result['verified']['checksRun'];
  if (!isRecord(run)) {
    return null;
  }
  const verdict = run['verdict'];
  const reason = run['reason'];
  const commit = run['commit'];
  if (
    (verdict !== 'green' && verdict !== 'red' && verdict !== 'not_checked') ||
    (commit !== null && typeof commit !== 'string')
  ) {
    return null;
  }
  if (reason === null) {
    return { verdict, reason: null, commit };
  }
  const known = REASONS.find((candidate) => candidate === reason);
  return known === undefined ? null : { verdict, reason: known, commit };
};
