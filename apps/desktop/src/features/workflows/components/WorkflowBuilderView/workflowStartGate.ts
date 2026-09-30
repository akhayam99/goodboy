import type { Mode } from '../../../../store/slices/workflowDrafts/types';

export type WorkflowStartGate = {
  readonly isDisabled: boolean;
  readonly reason: string | null;
};

type Params = {
  readonly mode: Mode;
  readonly isStarting: boolean;
  readonly isPlanning: boolean;
  readonly hasGoal: boolean;
  readonly hasSteps: boolean;
  readonly isSpendLimitValid: boolean;
};

const STEPS_REASON: Record<Exclude<Mode, 'dynamic'>, string> = {
  preset: 'Select a preset to start',
  custom: 'Add a step or generate a plan to start',
};

export const workflowStartGate = ({
  mode,
  isStarting,
  isPlanning,
  hasGoal,
  hasSteps,
  isSpendLimitValid,
}: Params): WorkflowStartGate => {
  if (isStarting) {
    return { isDisabled: true, reason: 'This workflow is already starting' };
  }
  if (isPlanning) {
    return { isDisabled: true, reason: 'Wait for the plan to come back to start' };
  }
  if (!hasGoal) {
    return { isDisabled: true, reason: 'Set a goal to start' };
  }
  if (mode !== 'dynamic' && !hasSteps) {
    return { isDisabled: true, reason: STEPS_REASON[mode] };
  }
  if (!isSpendLimitValid) {
    return { isDisabled: true, reason: 'Enter a valid spend limit to start' };
  }
  return { isDisabled: false, reason: null };
};
