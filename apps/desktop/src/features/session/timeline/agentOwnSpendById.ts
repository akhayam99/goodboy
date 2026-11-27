import type { Agent, AgentId, TelemetryRecord } from '@goodboy/types';

type Params = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly agents: ReadonlyArray<Pick<Agent, 'id' | 'runId'>>;
  readonly agentRunHistory: Readonly<Record<string, ReadonlyArray<string>>>;
};

export const agentOwnSpendById = ({
  records,
  agents,
  agentRunHistory,
}: Params): ReadonlyMap<AgentId, number> => {
  const spendByRunId = new Map<string, number>();
  for (const record of records) {
    if (record.kind === 'summarizer') {
      continue;
    }
    spendByRunId.set(record.runId, (spendByRunId.get(record.runId) ?? 0) + record.estimatedCostUsd);
  }
  const ownSpend = new Map<AgentId, number>();
  for (const agent of agents) {
    const runIds = new Set<string>(agentRunHistory[agent.id] ?? []);
    if (agent.runId != null) {
      runIds.add(agent.runId);
    }
    let sum = 0;
    for (const runId of runIds) {
      sum += spendByRunId.get(runId) ?? 0;
    }
    ownSpend.set(agent.id, sum);
  }
  return ownSpend;
};
