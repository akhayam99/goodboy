import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  ProviderName,
  ProviderRunId,
  SessionId,
  TelemetryRecord,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { ProviderContextUsage } from '../../../workspace/components/WorkspacesSidebar/parts/ContextWindowBar';
import type { AgentAggregate } from '../../components/AgentMetricsBlock';
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
};

const latestTurnTelemetryByRunId = (
  telemetry: ReadonlyArray<TelemetryRecord>,
): Map<string, TelemetryRecord> => {
  const map = new Map<string, TelemetryRecord>();
  for (const rec of telemetry) {
    if (rec.kind !== 'turn') {
      continue;
    }
    const existing = map.get(rec.runId);
    if (existing == null || existing.recordedAt < rec.recordedAt) {
      map.set(rec.runId, rec);
    }
  }
  return map;
};

const childIdsByParentId = (agents: ReadonlyArray<Agent>): Map<string, ReadonlyArray<string>> => {
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

const mergeProviderEntry = (target: Map<ProviderName, ProviderEntry>, entry: ProviderEntry) => {
  const existing = target.get(entry.provider);
  if (existing == null) {
    target.set(entry.provider, { ...entry });
    return;
  }
  existing.inputTokens += entry.inputTokens;
  existing.outputTokens += entry.outputTokens;
  if (existing.recordedAt < entry.recordedAt) {
    existing.recordedAt = entry.recordedAt;
    existing.model = entry.model;
  }
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

  const telemetryByRunId = useMemo(() => {
    const map = new Map<string, TelemetryRecord>();
    for (const rec of telemetry) {
      const existing = map.get(rec.runId);
      if (existing == null || existing.recordedAt < rec.recordedAt) {
        map.set(rec.runId, rec);
      }
    }
    return map;
  }, [telemetry]);

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
    const turnTelemetry = latestTurnTelemetryByRunId(telemetry);
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
        const rec = turnTelemetry.get(runId);
        if (rec == null) {
          continue;
        }
        totals.inputTokens += rec.inputTokens;
        totals.outputTokens += rec.outputTokens;
        totals.estimatedCostUsd += rec.estimatedCostUsd;
        totals.turns += 1;
      }
      map.set(run.id, totals);
    }
    const childIds = childIdsByParentId(phaseRuns);
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
    const turnTelemetry = latestTurnTelemetryByRunId(telemetry);
    const map = new Map<string, Map<ProviderName, ProviderEntry>>();
    for (const run of phaseRuns) {
      const runIds = agentRunHistory[run.id] ?? (run.runId != null ? [run.runId] : []);
      const byProvider = new Map<ProviderName, ProviderEntry>();
      for (const runId of runIds) {
        const rec = turnTelemetry.get(runId);
        if (rec == null) {
          continue;
        }
        mergeProviderEntry(byProvider, {
          provider: rec.provider,
          model: rec.model,
          recordedAt: rec.recordedAt,
          inputTokens: rec.inputTokens,
          outputTokens: rec.outputTokens,
        });
      }
      map.set(run.id, byProvider);
    }
    const childIds = childIdsByParentId(phaseRuns);
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
        for (const entry of child.values()) {
          mergeProviderEntry(self, entry);
        }
      }
    };
    for (const run of phaseRuns) {
      rollup(run.id);
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
          }))
          .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)),
      );
    }
    return result;
  }, [telemetry, phaseRuns, agentRunHistory]);

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
