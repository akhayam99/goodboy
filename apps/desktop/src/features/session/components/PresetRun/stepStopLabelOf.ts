import type { Agent, Workflow } from '@goodboy/types';
import { stepNumberOf } from './stepNumberOf';

type Params = {
  readonly agent: Agent;
  readonly stepAgent: Agent | null;
  readonly workflow: Workflow;
};

export const stepStopLabelOf = ({ agent, stepAgent, workflow }: Params): string | undefined => {
  if (stepAgent === null || stepAgent.id !== agent.id) {
    return undefined;
  }
  const number = stepNumberOf({ workflow, agent: stepAgent });
  return number === null ? undefined : `Stop step ${number}`;
};
