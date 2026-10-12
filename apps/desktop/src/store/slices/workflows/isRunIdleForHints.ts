import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const isRunIdleForHints = ({ get, sessionId, workflowRunId }: Params): boolean => {
  const run = findWorkflowRun({ get, sessionId, workflowRunId });
  if (run == null || run.executionMode !== 'dynamic' || run.discardedAt != null) {
    return false;
  }
  if (run.orchestrationOutcome == null || run.orchestrationStop != null) {
    return false;
  }
  if (get().orchestratingWorkflowRuns[workflowRunId] === true) {
    return false;
  }
  return get().pendingOrchestrations[workflowRunId] == null;
};
