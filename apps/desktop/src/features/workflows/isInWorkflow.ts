import type { Agent, AgentId, Session } from '@goodboy/types';
import { hasActiveWorkflowRun } from './activeWorkflowRuns';

type Params = {
  readonly session: Session;
  readonly agents: ReadonlyArray<Agent>;
  readonly agentId: AgentId;
};

export const isInWorkflow = ({ session, agents, agentId }: Params): boolean =>
  hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents }) ||
  agents.some(
    (agent) => agent.id === agentId && agent.stepId != null && agent.workflowRunId != null,
  );
