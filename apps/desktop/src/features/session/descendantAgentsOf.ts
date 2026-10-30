import type { Agent, AgentId } from '@goodboy/types';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly rootId: AgentId;
};

export const descendantAgentsOf = ({ agents, rootId }: Params): ReadonlyArray<Agent> => {
  const found: Array<Agent> = [];
  const seen = new Set<string>([rootId]);
  let frontier: ReadonlyArray<string> = [rootId];
  while (frontier.length > 0) {
    const children = agents.filter(
      (agent) =>
        agent.parentAgentId != null &&
        frontier.includes(agent.parentAgentId) &&
        !seen.has(agent.id),
    );
    for (const child of children) {
      seen.add(child.id);
      found.push(child);
    }
    frontier = children.map((child) => child.id);
  }
  return found;
};
