import type { Agent, AgentId, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { agentOwnSpendById } from './agentOwnSpendById';

type Params = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly agents: ReadonlyArray<Agent>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
};

type RollupParams = {
  readonly id: AgentId;
};

export const agentSpendById = ({
  records,
  agents,
  agentRunHistory,
}: Params): ReadonlyMap<AgentId, number> => {
  const ownSpend = agentOwnSpendById({ records, agents, agentRunHistory });
  const childIds = new Map<AgentId, AgentId[]>();
  for (const agent of agents) {
    if (agent.parentAgentId != null) {
      const siblings = childIds.get(agent.parentAgentId) ?? [];
      siblings.push(agent.id);
      childIds.set(agent.parentAgentId, siblings);
    }
  }
  const total = new Map<AgentId, number>();
  const visiting = new Set<AgentId>();
  const rollup = ({ id }: RollupParams): number => {
    const known = total.get(id);
    if (known != null) {
      return known;
    }
    if (visiting.has(id)) {
      return 0;
    }
    visiting.add(id);
    let sum = ownSpend.get(id) ?? 0;
    for (const childId of childIds.get(id) ?? []) {
      sum += rollup({ id: childId });
    }
    total.set(id, sum);
    return sum;
  };
  for (const agent of agents) {
    rollup({ id: agent.id });
  }
  return total;
};
