import type { Tone } from '@goodboy/ui';
import type { BranchNextStep } from './branchNextStepOf';

export type BranchStartLine = {
  readonly word: string;
  readonly tone: Tone;
  readonly distance: string | null;
};

type Params = {
  readonly step: BranchNextStep;
  readonly baseBranch: string;
};

export const branchStartLineOf = ({ step, baseBranch }: Params): BranchStartLine => {
  if (step.state === 'conflict') {
    return { word: 'Rebasing', tone: 'warning', distance: null };
  }
  if (step.diverged !== null) {
    return {
      word: `Diverged: ${step.unpushed} not pushed, ${step.diverged.online} only on origin`,
      tone: 'warning',
      distance: null,
    };
  }
  if (step.unpushed > 0) {
    return {
      word: `${step.unpushed} not pushed`,
      tone: 'neutral',
      distance: step.behind === null ? null : `${step.behind} behind ${baseBranch}`,
    };
  }
  if ((step.originOnly ?? 0) > 0) {
    return { word: `${step.originOnly} only on origin`, tone: 'warning', distance: null };
  }
  return {
    word: step.isPushed ? 'Up to date with origin' : 'Not pushed',
    tone: 'neutral',
    distance: null,
  };
};
