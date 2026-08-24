import type { ProviderName, ProviderRunId, TelemetryRecord } from '@goodboy/types';

export type ExecutedAgentRouting = Readonly<{
  provider: ProviderName;
  model: string;
}>;

type Params = {
  readonly agentRunId: ProviderRunId | null;
  readonly runHistory: ReadonlyArray<ProviderRunId>;
  readonly records: ReadonlyArray<TelemetryRecord>;
};

export const executedAgentRouting = ({
  agentRunId,
  runHistory,
  records,
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
    const record = latestByRunId.get(runIds[index]!);
    if (record != null) {
      return { provider: record.provider, model: record.model };
    }
  }
  return null;
};
