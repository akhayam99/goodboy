import type { Agent, AgentId } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

export const childAgentsByParent = ({
  agents,
}: Params): ReadonlyMap<AgentId, ReadonlyArray<Agent>> => {
  const children = new Map<AgentId, Array<Agent>>();
  for (const agent of agents) {
    if (agent.parentAgentId == null) {
      continue;
    }
    const siblings = children.get(agent.parentAgentId);
    if (siblings === undefined) {
      children.set(agent.parentAgentId, [agent]);
      continue;
    }
    siblings.push(agent);
  }
  return children;
};
