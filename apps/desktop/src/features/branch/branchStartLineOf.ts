import type { Tone } from '@goodboy/ui';
import { formatAge } from '../../shared/utils/time/formatAge';
import type { LocalCheckResult } from '../../store/slices/local-checks/state';
import type { BranchNextStep } from './branchNextStepOf';

export type BranchStartLine = {
  readonly word: string;
  readonly tone: Tone;
  readonly distance: string | null;
  readonly check: BranchStartCheck | null;
};

type BranchStartCheck = {
  readonly word: string;
  readonly tone: Tone;
};

type Params = {
  readonly step: BranchNextStep;
  readonly baseBranch: string;
  readonly localCheck: LocalCheckResult | null;
  readonly now: number;
};

type CheckParams = Pick<Params, 'localCheck' | 'now'>;

const checkOf = ({ localCheck, now }: CheckParams): BranchStartCheck | null => {
  if (localCheck === null) {
    return null;
  }
  const age = formatAge({ from: localCheck.at, now });
  const when = age === '' ? '' : `, ${age}`;
  return localCheck.outcome === 'passed'
    ? { word: `Pre-push hook passed${when}`, tone: 'success' }
    : { word: `Pre-push hook declined${when}`, tone: 'danger' };
};

type StoppedParams = Pick<Params, 'step'>;

const stoppedWordOf = ({ step }: StoppedParams): Pick<BranchStartLine, 'word' | 'tone'> | null => {
  if (step.state === 'conflict') {
    return { word: 'Rebasing', tone: 'warning' };
  }
  if (step.diverged !== null) {
    return {
      word: `Diverged: ${step.unpushed} not pushed, ${step.diverged.online} only on origin`,
      tone: 'warning',
    };
  }
  if ((step.originOnly ?? 0) > 0 && step.unpushed === 0) {
    return { word: `${step.originOnly} only on origin`, tone: 'warning' };
  }
  return null;
};

export const branchStartLineOf = ({
  step,
  baseBranch,
  localCheck,
  now,
}: Params): BranchStartLine => {
  const check = checkOf({ localCheck, now });
  const stopped = stoppedWordOf({ step });
  if (stopped !== null) {
    return { ...stopped, distance: null, check };
  }
  const distance =
    step.behind === null || step.behind === 0 ? null : `${step.behind} behind ${baseBranch}`;
  if (step.unpushed > 0) {
    return { word: `${step.unpushed} not pushed`, tone: 'neutral', distance, check };
  }
  return {
    word: step.isPushed ? 'Up to date with origin' : 'Not pushed',
    tone: 'neutral',
    distance,
    check,
  };
};
