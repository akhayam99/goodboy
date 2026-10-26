import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { LocalCheckResult } from '../../../../store/slices/local-checks/state';
import { BRANCH_STATE_TONE } from '../../../session/central/branches/branchStateTone';
import type { BranchNextStep } from '../../branchNextStepOf';
import type { StatusCell } from './statusCell';

type Params = {
  readonly step: BranchNextStep;
  readonly baseBranch: string;
  readonly conflictCount: number;
  readonly localCheck: LocalCheckResult | null;
  readonly now: number;
};

type CountParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const counted = ({ count, one, many }: CountParams): string =>
  `${count} ${count === 1 ? one : many}`;

const localCell = ({ localCheck, now }: Pick<Params, 'localCheck' | 'now'>): StatusCell => {
  const cell = { id: 'local' as const, label: 'Local checks', opens: null };
  if (localCheck === null) {
    return { ...cell, word: 'Not run', detail: 'pre-push hook runs on push', tone: 'neutral' };
  }
  const age = formatAge({ from: localCheck.at, now });
  const detail = age === '' ? 'pre-push hook' : `pre-push hook, ${age}`;
  return localCheck.outcome === 'passed'
    ? { ...cell, word: 'Passed', detail, tone: 'success' }
    : { ...cell, word: 'Declined', detail, tone: 'danger' };
};

const requestCell = ({ step }: Pick<Params, 'step'>): StatusCell => ({
  id: 'request',
  label: 'Pull request',
  word: 'None yet',
  detail: step.state === 'conflict' ? 'after the rebase' : null,
  tone: BRANCH_STATE_TONE['no-request'],
  opens: null,
});

const remoteCell = ({ step }: Pick<Params, 'step'>): StatusCell => {
  const onlyHere =
    step.unpushed > 0
      ? `${counted({ count: step.unpushed, one: 'commit', many: 'commits' })} only here`
      : null;
  if (step.diverged !== null) {
    return {
      id: 'remote',
      label: 'Remote',
      word: 'Diverged',
      detail: `${step.diverged.yours} yours and ${step.diverged.online} online`,
      tone: 'warning',
      opens: null,
    };
  }
  if (!step.isPushed) {
    return {
      id: 'remote',
      label: 'Remote',
      word: 'Not pushed',
      detail: onlyHere,
      tone: BRANCH_STATE_TONE['not-pushed'],
      opens: null,
    };
  }
  return {
    id: 'remote',
    label: 'Remote',
    word: onlyHere === null ? 'Pushed' : 'Ahead of origin',
    detail: onlyHere ?? 'origin is up to date',
    tone: onlyHere === null ? 'success' : BRANCH_STATE_TONE['not-pushed'],
    opens: null,
  };
};

type BranchParams = Pick<Params, 'step' | 'baseBranch' | 'conflictCount'>;

const branchCell = ({ step, baseBranch, conflictCount }: BranchParams): StatusCell => {
  const cell = { id: 'branch' as const, label: 'Branch', opens: null };
  if (step.state === 'conflict') {
    return {
      ...cell,
      word: 'Conflicts',
      detail:
        conflictCount > 0
          ? `${counted({ count: conflictCount, one: 'file', many: 'files' })}, onto ${baseBranch}`
          : `onto ${baseBranch}`,
      tone: BRANCH_STATE_TONE.conflicts,
    };
  }
  if (step.state === 'empty') {
    return {
      ...cell,
      word: 'No commits yet',
      detail: `nothing ahead of ${baseBranch}`,
      tone: BRANCH_STATE_TONE['nothing-committed'],
    };
  }
  if (step.behind === null) {
    return { ...cell, word: 'Unknown', detail: null, tone: 'neutral' };
  }
  if (step.behind > 0) {
    return {
      ...cell,
      word: `${step.behind} behind`,
      detail: `${baseBranch} moved`,
      tone: 'neutral',
    };
  }
  return { ...cell, word: 'Up to date', detail: `with ${baseBranch}`, tone: 'neutral' };
};

export const branchStartCellsOf = ({
  step,
  baseBranch,
  conflictCount,
  localCheck,
  now,
}: Params): ReadonlyArray<StatusCell> => [
  localCell({ localCheck, now }),
  requestCell({ step }),
  remoteCell({ step }),
  branchCell({ step, baseBranch, conflictCount }),
];
