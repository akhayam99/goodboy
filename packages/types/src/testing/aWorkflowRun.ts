import type { WorkflowRun } from '../workspace';
import { nextWorkflowId, nextWorkflowRunId } from './testIds';

export const aWorkflowRun = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: nextWorkflowRunId(),
  workflowId: nextWorkflowId(),
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'static',
  ...overrides,
});
