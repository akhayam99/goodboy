import type { Agent, AgentId } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly parentId: AgentId;
};

export const orderedChildAgentsOf = ({ agents, parentId }: Params): ReadonlyArray<Agent> =>
  agents
    .filter((agent) => agent.parentAgentId === parentId)
    .sort((first, second) => first.ordinal - second.ordinal);
