import type { Agent, ClusterCompletionHold, Workflow, WorkflowRun } from '@goodboy/types';
import { isWorkflowComplete } from '@goodboy/core';
import { isCompletedAttempt } from '../../store/slices/workflows/clusterSourceProgress';

type Params = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly agents: ReadonlyArray<Agent>;
  readonly holds: ReadonlyArray<ClusterCompletionHold>;
};

const isSettled = (agent: Agent): boolean =>
  agent.status === 'completed' || agent.status === 'skipped';

export const isWorkflowRunComplete = ({ run, workflow, agents, holds }: Params): boolean => {
  const hasPendingDescendant = agents.some(
    (agent) =>
      agent.parentAgentId != null &&
      !isSettled(agent) &&
      isCompletedAttempt({ agent, holds }) === false,
  );
  if (hasPendingDescendant) {
    return false;
  }
  if (run.executionMode === 'dynamic') {
    return run.orchestrationOutcome === 'done';
  }
  const stepAgents = agents.filter((agent) => agent.parentAgentId == null);
  return workflow.steps.length > 0 && isWorkflowComplete(workflow, stepAgents);
};
