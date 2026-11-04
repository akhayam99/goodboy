import type { Agent } from '@goodboy/types';
import { notFinishedKindOf } from '@goodboy/core/workflows';

export type NotFinishedStep = {
  readonly agent: Agent;
  readonly number: number;
};

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

type NumberParams = {
  readonly agent: Agent;
};

export const notFinishedStepsOf = ({ agents }: Params): ReadonlyArray<NotFinishedStep> => {
  const steps = agents
    .filter((agent) => agent.parentAgentId == null)
    .sort((left, right) => left.ordinal - right.ordinal);
  const numberOf = ({ agent }: NumberParams): number => {
    const ownerId = agent.parentAgentId ?? agent.id;
    return steps.findIndex((step) => step.id === ownerId) + 1;
  };
  return agents
    .filter((agent) => notFinishedKindOf({ agent }) === 'stuck')
    .map((agent) => ({ agent, number: numberOf({ agent }) }))
    .sort((left, right) => left.number - right.number || left.agent.ordinal - right.agent.ordinal);
};
