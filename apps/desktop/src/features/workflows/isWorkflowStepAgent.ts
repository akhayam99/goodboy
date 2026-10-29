import type { Agent, AgentId } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly agentId: AgentId;
};

export const isWorkflowStepAgent = ({ agents, agentId }: Params): boolean =>
  agents.some(
    (agent) => agent.id === agentId && agent.stepId != null && agent.workflowRunId != null,
  );
