import type { Agent, AgentId, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import { classifyAgent, type AgentKind } from '../session/agent-kind';

export type AgentSpend = {
  readonly key: string;
  readonly agentId: AgentId | null;
  readonly name: string;
  readonly kind: AgentKind;
  readonly model: string;
  readonly costUsd: number;
};

export type SessionSpendBreakdown = {
  readonly totalUsd: number;
  readonly contextUsd: number;
  readonly agents: ReadonlyArray<AgentSpend>;
};

type Params = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly agents: ReadonlyArray<Agent>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
};

const OTHER_KEY = 'other';
const ASK_KEY = 'ask';

type Bucket = {
  agentId: AgentId | null;
  name: string;
  kind: AgentKind;
  model: string;
  modelAt: string;
  costUsd: number;
};

export const sessionSpendByAgent = ({
  records,
  agents,
  agentRunHistory,
  agentKindOverride,
}: Params): SessionSpendBreakdown => {
  const agentByRun = new Map<ProviderRunId, Agent>();
  for (const agent of agents) {
    if (agent.runId != null) {
      agentByRun.set(agent.runId, agent);
    }
    for (const runId of agentRunHistory[agent.id] ?? []) {
      agentByRun.set(runId, agent);
    }
  }
  const buckets = new Map<string, Bucket>();
  let totalUsd = 0;
  let contextUsd = 0;
  for (const record of records) {
    totalUsd += record.estimatedCostUsd;
    if (record.kind === 'summarizer') {
      contextUsd += record.estimatedCostUsd;
      continue;
    }
    const agent = agentByRun.get(record.runId) ?? null;
    const isAsk = record.kind === 'ask';
    const key = isAsk ? ASK_KEY : agent === null ? OTHER_KEY : agent.id;
    const bucket = buckets.get(key) ?? {
      agentId: agent === null || isAsk ? null : agent.id,
      name: isAsk ? 'Ask' : agent === null ? 'Other work' : agent.name,
      kind:
        agent === null || isAsk
          ? 'generic'
          : classifyAgent({ agent, override: agentKindOverride[agent.id] ?? null }),
      model: record.model,
      modelAt: record.recordedAt,
      costUsd: 0,
    };
    bucket.costUsd += record.estimatedCostUsd;
    if (record.recordedAt >= bucket.modelAt) {
      bucket.model = record.model;
      bucket.modelAt = record.recordedAt;
    }
    buckets.set(key, bucket);
  }
  const rows = [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      agentId: bucket.agentId,
      name: bucket.name,
      kind: bucket.kind,
      model: bucket.model,
      costUsd: bucket.costUsd,
    }))
    .sort((left, right) => right.costUsd - left.costUsd);
  return { totalUsd, contextUsd, agents: rows };
};
