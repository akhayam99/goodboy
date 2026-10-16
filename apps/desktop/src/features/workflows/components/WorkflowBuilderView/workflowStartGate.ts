import type { Mode } from '../../../../store/slices/workflowDrafts/types';

export type WorkflowStartGate = {
  readonly isDisabled: boolean;
  readonly reason: string | null;
};

type Params = {
  readonly mode: Mode;
  readonly isStarting: boolean;
  readonly hasGoal: boolean;
  readonly hasSteps: boolean;
  readonly isSpendLimitValid: boolean;
};

export const workflowStartGate = ({
  mode,
  isStarting,
  hasGoal,
  hasSteps,
  isSpendLimitValid,
}: Params): WorkflowStartGate => {
  if (isStarting) {
    return { isDisabled: true, reason: 'This run is already starting' };
  }
  if (!hasGoal) {
    return { isDisabled: true, reason: 'Set a goal to start' };
  }
  if (mode === 'preset' && !hasSteps) {
    return { isDisabled: true, reason: 'Select a preset to start' };
  }
  if (!isSpendLimitValid) {
    return { isDisabled: true, reason: 'Enter a valid limit to start' };
  }
  return { isDisabled: false, reason: null };
};
