import type { Step } from '@goodboy/types';
import type { WorkflowAdvanceState, WorkflowBlockReason } from './advanceGate';

export type WorkflowAdvanceView = {
  readonly chainStep: Step | null;
  readonly manualStep: Step | null;
  readonly failedStep: Step | null;
  readonly blockReason: WorkflowBlockReason | null;
};

type Params = {
  readonly state: WorkflowAdvanceState;
};

const IDLE: WorkflowAdvanceView = {
  chainStep: null,
  manualStep: null,
  failedStep: null,
  blockReason: null,
};

export const viewWorkflowAdvance = ({ state }: Params): WorkflowAdvanceView => {
  switch (state.kind) {
    case 'complete':
      return IDLE;
    case 'automatic':
      return { ...IDLE, chainStep: state.step };
    case 'ready':
      return { ...IDLE, chainStep: state.step, manualStep: state.step };
    case 'blocked':
      return {
        chainStep: state.failedStep != null ? null : state.step,
        manualStep: null,
        failedStep: state.failedStep,
        blockReason: state.reason,
      };
    default: {
      const unexpectedState: never = state;
      return unexpectedState;
    }
  }
};
