import type { Agent, AgentId, WorkflowRunId } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflowRunId: WorkflowRunId;
};

export const cutStepIdOf = ({ agents, workflowRunId }: Params): AgentId | null =>
  [...agents]
    .filter(
      (agent) =>
        agent.workflowRunId === workflowRunId &&
        agent.parentAgentId == null &&
        agent.deletedAt == null &&
        agent.status === 'stopped' &&
        agent.stoppedBy !== 'app',
    )
    .sort((left, right) => left.ordinal - right.ordinal)[0]?.id ?? null;
