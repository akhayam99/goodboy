import type { ProviderName, ProviderRunId, TelemetryRecord } from '@goodboy/types';

export type ExecutedAgentRouting = Readonly<{
  provider: ProviderName;
  model: string;
}>;

type Params = {
  readonly agentRunId: ProviderRunId | null;
  readonly runHistory: ReadonlyArray<ProviderRunId>;
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly liveRouting: Readonly<Record<ProviderRunId, ExecutedAgentRouting>>;
};

export const executedAgentRouting = ({
  agentRunId,
  runHistory,
  records,
  liveRouting,
}: Params): ExecutedAgentRouting | null => {
  const runIds = runHistory.length > 0 ? runHistory : agentRunId != null ? [agentRunId] : [];
  if (runIds.length === 0) {
    return null;
  }
  const latestByRunId = new Map<ProviderRunId, TelemetryRecord>();
  for (const record of records) {
    if (record.kind !== 'turn') {
      continue;
    }
    const existing = latestByRunId.get(record.runId);
    if (existing == null || existing.recordedAt <= record.recordedAt) {
      latestByRunId.set(record.runId, record);
    }
  }
  for (let index = runIds.length - 1; index >= 0; index -= 1) {
    const runId = runIds[index]!;
    const record = latestByRunId.get(runId);
    if (record != null) {
      return { provider: record.provider, model: record.model };
    }
    const live = liveRouting[runId];
    if (live != null) {
      return live;
    }
  }
  return null;
};
