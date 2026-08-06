import type { Step } from '@goodboy/types';
import type { WorkflowAdvanceState, WorkflowBlockReason } from './advanceGate';

export type WorkflowAdvanceView = {
  readonly pendingStep: Step | null;
  readonly manualStep: Step | null;
  readonly failedStep: Step | null;
  readonly blockReason: WorkflowBlockReason | null;
};

type Params = {
  readonly state: WorkflowAdvanceState;
};

const IDLE: WorkflowAdvanceView = {
  pendingStep: null,
  manualStep: null,
  failedStep: null,
  blockReason: null,
};

export const viewWorkflowAdvance = ({ state }: Params): WorkflowAdvanceView => {
  switch (state.kind) {
    case 'complete':
      return IDLE;
    case 'automatic':
      return { ...IDLE, pendingStep: state.step };
    case 'ready':
      return { ...IDLE, pendingStep: state.step, manualStep: state.step };
    case 'blocked':
      return {
        pendingStep: state.reason === 'failed-step' ? null : state.step,
        manualStep: null,
        failedStep: state.reason === 'failed-step' ? state.step : null,
        blockReason: state.reason,
      };
    default: {
      const unexpectedState: never = state;
      return unexpectedState;
    }
  }
};
