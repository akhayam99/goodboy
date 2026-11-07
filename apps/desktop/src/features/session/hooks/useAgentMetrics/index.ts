import { useMemo } from 'react';
import { contextTokensForUsage, inputTokensForUsage } from '@goodboy/core/providers';
import type { Agent, AgentId, ProviderName, SessionId, TelemetryRecord } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { ProviderContextUsage } from '../../components/AgentTree/ContextWindowBar';
import type { AgentAggregate } from '../../agentAggregate';
import { useSessionRunHistory } from '../../../../shared/hooks/useSessionRunHistory';
import { agentSpendById } from '../../timeline/agentSpendById';
import { childAgentsByParent } from '../../../../shared/utils/childAgentsByParent';

export type AgentMetrics = {
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
  const agentRunHistory = useSessionRunHistory({ sessionId });

  const telemetryByRunId = useMemo(() => latestTurnTelemetryByRunId({ telemetry }), [telemetry]);

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
        totals.turns += rec.turns;
      }
      map.set(run.id, totals);
    }
    const childrenOf = childAgentsByParent({ agents: phaseRuns });
    const rolled = new Set<string>();
    const rollup = (id: AgentId) => {
      if (rolled.has(id)) {
        return;
      }
      rolled.add(id);
      const self = map.get(id);
      if (self == null) {
        return;
      }
      for (const { id: childId } of childrenOf.get(id) ?? []) {
        rollup(childId);
        const child = map.get(childId);
        if (child == null) {
          continue;
        }
        self.inputTokens += child.inputTokens;
        self.outputTokens += child.outputTokens;
        self.turns += child.turns;
      }
    };
    for (const run of phaseRuns) {
      rollup(run.id);
    }
    const spendByAgentId = agentSpendById({
      records: telemetry,
      agents: phaseRuns,
      agentRunHistory,
    });
    for (const run of phaseRuns) {
      const totals = map.get(run.id);
      if (totals !== undefined) {
        totals.estimatedCostUsd = spendByAgentId.get(run.id) ?? 0;
      }
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
      aggregatesByAgentId,
      providerUsageByAgentId,
      turnsByAgentId,
    }),
    [aggregatesByAgentId, providerUsageByAgentId, turnsByAgentId],
  );
};
