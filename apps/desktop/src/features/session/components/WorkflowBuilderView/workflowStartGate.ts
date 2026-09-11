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
  readonly hasApproach: boolean;
  readonly hasName: boolean;
  readonly isSpendLimitValid: boolean;
};

const APPROACH_REASON: Record<Mode, string> = {
  preset: 'Select a preset to start',
  custom: 'Generate a plan to start',
  dynamic: 'Describe the intent and constraints to start',
};

export const workflowStartGate = ({
  mode,
  isStarting,
  isPlanning,
  hasGoal,
  hasApproach,
  hasName,
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
  if (!hasApproach) {
    return { isDisabled: true, reason: APPROACH_REASON[mode] };
  }
  if (!hasName) {
    return { isDisabled: true, reason: 'Name the workflow to start' };
  }
  if (!isSpendLimitValid) {
    return { isDisabled: true, reason: 'Enter a valid spend limit to start' };
  }
  return { isDisabled: false, reason: null };
};
