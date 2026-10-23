import type { Tone } from '@goodboy/ui';
import { BRANCH_STATE_TONE } from '../session/central/branches/branchStateTone';
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

type WordParams = {
  readonly step: BranchNextStep;
};

const wordOf = ({ step }: WordParams): Pick<BranchStartLine, 'word' | 'tone'> => {
  if (step.state === 'conflict') {
    return { word: 'Rebasing', tone: BRANCH_STATE_TONE.rebasing };
  }
  if (step.isPushed) {
    return { word: 'Pushed', tone: 'neutral' };
  }
  return { word: 'Not pushed', tone: BRANCH_STATE_TONE['not-pushed'] };
};

export const branchStartLineOf = ({ step, baseBranch }: Params): BranchStartLine => ({
  ...wordOf({ step }),
  distance:
    step.ahead === null || step.behind === null
      ? null
      : `${step.ahead} ahead, ${step.behind} behind ${baseBranch}`,
});
