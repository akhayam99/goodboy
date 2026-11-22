import type { Agent, ProviderRunId, TelemetryRecord } from '@goodboy/types';
import type { ProviderContextUsage } from '../AgentTree/ContextWindowBar';

type Params = {
  readonly agent: Pick<Agent, 'runId' | 'providerSessionProviderId' | 'providerOverride'>;
  readonly runIds: ReadonlyArray<ProviderRunId> | undefined;
  readonly telemetry: ReadonlyArray<TelemetryRecord>;
};

export const activeUsageOf = ({
  agent,
  runIds,
  telemetry,
}: Params): ProviderContextUsage | null => {
  const owned = runIds ?? (agent.runId === undefined ? [] : [agent.runId]);
  const provider = agent.providerSessionProviderId ?? agent.providerOverride ?? null;
  let latest: TelemetryRecord | null = null;
  for (const record of telemetry) {
    if (record.kind !== 'turn' || !owned.includes(record.runId)) {
      continue;
    }
    if (provider !== null && record.provider !== provider) {
      continue;
    }
    if (latest === null || latest.recordedAt <= record.recordedAt) {
      latest = record;
    }
  }
  if (latest === null) {
    return null;
  }
  return {
    provider: latest.provider,
    model: latest.model,
    inputTokens: latest.inputTokens,
    outputTokens: latest.outputTokens,
    cachedInputTokens: latest.cachedInputTokens ?? 0,
    cacheCreationInputTokens: latest.cacheCreationInputTokens ?? 0,
    ...(latest.contextTokens != null && { contextTokens: latest.contextTokens }),
  };
};
