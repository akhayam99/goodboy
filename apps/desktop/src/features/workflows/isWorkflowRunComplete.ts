import type { Agent, Workflow, WorkflowRun } from '@goodboy/types';
import { isAgentStatusSettled, isWorkflowComplete } from '@goodboy/core';
import { isWorkflowRunClosedByUser } from './isWorkflowRunClosedByUser';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow | null;
  readonly agents: ReadonlyArray<Agent>;
};

export const isWorkflowRunComplete = ({ run, workflow, agents }: Params): boolean => {
  if (isWorkflowRunClosedByUser({ run })) {
    return true;
  }
  const hasPendingDescendant = agents.some(
    (agent) => agent.parentAgentId != null && !isAgentStatusSettled({ status: agent.status }),
  );
  if (hasPendingDescendant) {
    return false;
  }
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  if (workflow === null) {
    return false;
  }
  const stepAgents = agents.filter((agent) => agent.parentAgentId == null);
  return workflow.steps.length > 0 && isWorkflowComplete(workflow, stepAgents);
};
