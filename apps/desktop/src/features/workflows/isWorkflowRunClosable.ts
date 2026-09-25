import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';
import { isWorkflowRunComplete } from './isWorkflowRunComplete';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow | null;
  readonly agents: ReadonlyArray<Agent>;
};

export const isWorkflowRunClosable = ({ run, workflow, agents }: Params): boolean => {
  if (run.discardedAt != null || isWorkflowRunClosedByUser({ run })) {
    return false;
  }
  const isQueued = run.triggerMode !== 'immediate' && agents.length === 0;
  if (isQueued) {
    return false;
  }
  if (run.executionMode === 'static' && agents.length === 0) {
    return false;
  }
  return !isWorkflowRunComplete({ run, workflow, agents });
};
