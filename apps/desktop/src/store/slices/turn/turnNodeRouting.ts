import type { Agent, Step, WorkflowModelPick } from '@goodboy/types';

type Params = {
  readonly agent: Agent | null;
  readonly step: Step | null;
};

export const turnNodeRouting = ({ agent, step }: Params): WorkflowModelPick | null => {
  const agentLock = agent?.routingLock?.pick ?? null;
  if (agentLock !== null) {
    return agentLock;
  }
  const stepLock = step?.routingLock?.pick ?? null;
  if (stepLock !== null) {
    return stepLock;
  }
  const agentSelection = agent?.routingDecision?.selected ?? null;
  if (agentSelection !== null) {
    return agentSelection;
  }
  return step?.routingDecision?.selected ?? null;
};
