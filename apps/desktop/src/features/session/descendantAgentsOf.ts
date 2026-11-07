import type { Agent, AgentId } from '@goodboy/types';
import { childAgentsByParent } from '../../shared/utils/childAgentsByParent';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly rootId: AgentId;
};

export const descendantAgentsOf = ({ agents, rootId }: Params): ReadonlyArray<Agent> => {
  const childrenOf = childAgentsByParent({ agents });
  const positionOf = new Map<AgentId, number>(agents.map((agent, index) => [agent.id, index]));
  const found: Array<Agent> = [];
  const seen = new Set<AgentId>([rootId]);
  let frontier: ReadonlyArray<AgentId> = [rootId];
  while (frontier.length > 0) {
    const level = frontier
      .flatMap((parentId) => childrenOf.get(parentId) ?? [])
      .filter((child) => !seen.has(child.id))
      .sort((first, second) => (positionOf.get(first.id) ?? 0) - (positionOf.get(second.id) ?? 0));
    for (const child of level) {
      seen.add(child.id);
      found.push(child);
    }
    frontier = level.map((child) => child.id);
  }
  return found;
};
