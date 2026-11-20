import type { Agent, AgentId } from '@goodboy/types';
import type { AgentAggregate } from './agentAggregate';

type Params = {
  readonly agentIds: ReadonlyArray<AgentId>;
  readonly agents: ReadonlyArray<Pick<Agent, 'id' | 'parentAgentId'>>;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
};

export const runCostUsdOf = ({ agentIds, agents, aggregatesByAgentId }: Params): number | null => {
  const members = new Set<AgentId>(agentIds);
  const parentOf = new Map(agents.map((agent) => [agent.id, agent.parentAgentId ?? null]));
  const isTracked = agentIds.some((id) => (aggregatesByAgentId.get(id)?.turns ?? 0) > 0);
  if (!isTracked) {
    return null;
  }
  return agentIds
    .filter((id) => {
      const parentId = parentOf.get(id) ?? null;
      return parentId === null || !members.has(parentId);
    })
    .reduce((total, id) => total + (aggregatesByAgentId.get(id)?.estimatedCostUsd ?? 0), 0);
};
