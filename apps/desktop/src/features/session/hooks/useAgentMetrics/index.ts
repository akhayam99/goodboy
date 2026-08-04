import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { contextTokensForUsage, inputTokensForUsage } from '@goodboy/core';
import type {
  Agent,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import type { AgentAggregate } from '../../components/AgentMetrics';
import { computeLatestTelemetryByAgentId } from '../../agent-row-format';

export type AgentMetrics = {
  readonly latestTelemetryByAgentId: ReadonlyMap<string, TelemetryRecord>;
  readonly aggregatesByAgentId: ReadonlyMap<string, AgentAggregate>;
  readonly providerUsageByAgentId: ReadonlyMap<string, ReadonlyArray<ProviderContextUsage>>;
  readonly turnsByAgentId: ReadonlyMap<string, number>;
};

type Params = {
  readonly sessionId: SessionId;
};

type MutableAggregate = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  turns: number;
};

type ProviderEntry = {
  provider: ProviderName;
  model: string;
  recordedAt: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheCreationInputTokens: number;
  contextTokens?: number;
};

type TelemetryParams = {
  readonly telemetry: ReadonlyArray<TelemetryRecord>;
};

const latestTurnTelemetryByRunId = ({
  telemetry,
}: TelemetryParams): Map<string, TelemetryRecord> => {
  const map = new Map<string, TelemetryRecord>();
  for (const rec of telemetry) {
    if (rec.kind !== 'turn') {
      continue;
    }
    const existing = map.get(rec.runId);
    if (existing == null || existing.recordedAt <= rec.recordedAt) {
      map.set(rec.runId, rec);
    }
  }
  return map;
};

const aggregatesByRunId = ({ telemetry }: TelemetryParams): Map<string, MutableAggregate> => {
  const map = new Map<string, MutableAggregate>();
  for (const record of telemetry) {
    const aggregate = map.get(record.runId) ?? {
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      turns: 0,
    };
    aggregate.estimatedCostUsd += record.estimatedCostUsd;
    map.set(record.runId, aggregate);
    if (record.kind !== 'turn') {
      continue;
    }
    aggregate.inputTokens += inputTokensForUsage(record);
    aggregate.outputTokens += record.outputTokens;
    aggregate.turns = 1;
  }
  return map;
};

type AgentParams = {
  readonly agents: ReadonlyArray<Agent>;
};

const childIdsByParentId = ({ agents }: AgentParams): Map<string, ReadonlyArray<string>> => {
  const map = new Map<string, string[]>();
  for (const agent of agents) {
    if (agent.parentAgentId == null) {
      continue;
    }
    const bucket = map.get(agent.parentAgentId) ?? [];
    bucket.push(agent.id);
    map.set(agent.parentAgentId, bucket);
  }
  return map;
};

type MergeParams = {
  readonly target: Map<ProviderName, ProviderEntry>;
  readonly entry: ProviderEntry;
};

const mergeProviderEntry = ({ target, entry }: MergeParams) => {
  const existing = target.get(entry.provider);
  if (existing != null && existing.recordedAt > entry.recordedAt) {
    return;
  }

  target.set(entry.provider, { ...entry });
};

export const useAgentMetrics = ({ sessionId }: Params): AgentMetrics => {
  const phaseRuns = useAppStore(
    (s) => s.sessionPhaseRuns[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<Agent>),
  );
  const telemetry = useAppStore(
    (s) => s.sessionTelemetry[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<TelemetryRecord>),
  );
  const messages = useAppStore((s) => s.messages[sessionId] ?? EMPTY_ARRAY);
  const agentRunHistory = useAppStore(
    useShallow((s) => {
      const out: Record<string, ReadonlyArray<ProviderRunId>> = {};
      const runs = s.sessionPhaseRuns[sessionId];
      if (runs == null) {
        return out;
      }
      for (const run of runs) {
        const history = s.agentRunHistory[run.id];
        if (history != null) {
          out[run.id] = history;
        }
      }
      return out;
    }),
  );

  const telemetryByRunId = useMemo(() => latestTurnTelemetryByRunId({ telemetry }), [telemetry]);

  const latestTelemetryByAgentId = useMemo(
    () => computeLatestTelemetryByAgentId(phaseRuns, agentRunHistory, telemetryByRunId),
    [phaseRuns, agentRunHistory, telemetryByRunId],
  );

  const turnsByAgentId = useMemo(() => {
    const map = new Map<string, number>();
    for (const message of messages) {
      if (message.role !== 'user') {
        continue;
      }
      map.set(message.agentId, (map.get(message.agentId) ?? 0) + 1);
    }
    return map;
  }, [messages]);

  const aggregatesByAgentId = useMemo(() => {
    const runAggregates = aggregatesByRunId({ telemetry });
    const map = new Map<string, MutableAggregate>();
    for (const run of phaseRuns) {
      const runIds = agentRunHistory[run.id] ?? (run.runId != null ? [run.runId] : []);
      const totals: MutableAggregate = {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        turns: 0,
      };
      for (const runId of runIds) {
        const rec = runAggregates.get(runId);
        if (rec == null) {
          continue;
        }
        totals.inputTokens += rec.inputTokens;
        totals.outputTokens += rec.outputTokens;
        totals.estimatedCostUsd += rec.estimatedCostUsd;
        totals.turns += rec.turns;
      }
      map.set(run.id, totals);
    }
    const childIds = childIdsByParentId({ agents: phaseRuns });
    const rolled = new Set<string>();
    const rollup = (id: string) => {
      if (rolled.has(id)) {
        return;
      }
      rolled.add(id);
      const self = map.get(id);
      if (self == null) {
        return;
      }
      for (const childId of childIds.get(id) ?? []) {
        rollup(childId);
        const child = map.get(childId);
        if (child == null) {
          continue;
        }
        self.inputTokens += child.inputTokens;
        self.outputTokens += child.outputTokens;
        self.estimatedCostUsd += child.estimatedCostUsd;
        self.turns += child.turns;
      }
    };
    for (const run of phaseRuns) {
      rollup(run.id);
    }
    return map;
  }, [telemetry, phaseRuns, agentRunHistory]);

  const providerUsageByAgentId = useMemo(() => {
    const map = new Map<string, Map<ProviderName, ProviderEntry>>();
    for (const run of phaseRuns) {
      const runIds = agentRunHistory[run.id] ?? (run.runId != null ? [run.runId] : []);
      const byProvider = new Map<ProviderName, ProviderEntry>();
      for (const runId of runIds) {
        const rec = telemetryByRunId.get(runId);
        if (rec == null) {
          continue;
        }
        mergeProviderEntry({
          target: byProvider,
          entry: {
            provider: rec.provider,
            model: rec.model,
            recordedAt: rec.recordedAt,
            inputTokens: rec.inputTokens,
            outputTokens: rec.outputTokens,
            cachedInputTokens: rec.cachedInputTokens ?? 0,
            cacheCreationInputTokens: rec.cacheCreationInputTokens ?? 0,
            ...(rec.contextTokens != null && { contextTokens: rec.contextTokens }),
          },
        });
      }
      map.set(run.id, byProvider);
    }
    const result = new Map<string, ReadonlyArray<ProviderContextUsage>>();
    for (const [id, byProvider] of map) {
      result.set(
        id,
        [...byProvider.values()]
          .map((entry) => ({
            provider: entry.provider,
            model: entry.model,
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
            cachedInputTokens: entry.cachedInputTokens,
            cacheCreationInputTokens: entry.cacheCreationInputTokens,
            ...(entry.contextTokens != null && { contextTokens: entry.contextTokens }),
          }))
          .sort((a, b) => (contextTokensForUsage(b) ?? 0) - (contextTokensForUsage(a) ?? 0)),
      );
    }
    return result;
  }, [telemetryByRunId, phaseRuns, agentRunHistory]);

  return useMemo(
    () => ({
      latestTelemetryByAgentId,
      aggregatesByAgentId,
      providerUsageByAgentId,
      turnsByAgentId,
    }),
    [latestTelemetryByAgentId, aggregatesByAgentId, providerUsageByAgentId, turnsByAgentId],
  );
};
