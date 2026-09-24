import type { Agent, AgentId, ProviderRunId, TelemetryRecord } from '@goodboy/types';

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
  const spendByRunId = new Map<ProviderRunId, number>();
  for (const record of records) {
    if (record.kind === 'summarizer') {
      continue;
    }
    spendByRunId.set(record.runId, (spendByRunId.get(record.runId) ?? 0) + record.estimatedCostUsd);
  }
  const ownSpend = new Map<AgentId, number>();
  const childIds = new Map<AgentId, AgentId[]>();
  for (const agent of agents) {
    const runIds = new Set<ProviderRunId>(agentRunHistory[agent.id] ?? []);
    if (agent.runId != null) {
      runIds.add(agent.runId);
    }
    let sum = 0;
    for (const runId of runIds) {
      sum += spendByRunId.get(runId) ?? 0;
    }
    ownSpend.set(agent.id, sum);
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
