import type { Agent, AgentStatus, Step } from '@goodboy/types';
import type { WorkflowRoutingNodeKind } from './types';

const BLOCKING_STATUSES: ReadonlyArray<AgentStatus> = ['running', 'completed'];

type Params = {
  readonly nodeKind: WorkflowRoutingNodeKind;
  readonly agent: Agent | null;
  readonly step: Step | null;
  readonly agents: ReadonlyArray<Agent>;
};

export const isWorkflowNodeRoutingMutable = ({
  nodeKind,
  agent,
  step,
  agents,
}: Params): boolean => {
  if (nodeKind === 'agent') {
    if (agent === null) {
      return false;
    }
    return BLOCKING_STATUSES.includes(agent.status) === false;
  }
  if (step === null) {
    return false;
  }
  return (
    agents.some(
      (candidate) => candidate.stepId === step.id && BLOCKING_STATUSES.includes(candidate.status),
    ) === false
  );
};
