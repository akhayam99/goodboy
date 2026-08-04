import type { IsoDateTime, ProviderRunId, SessionId, TelemetryRecordId } from './ids';
import type { ProviderName } from './provider';

export type TelemetryKind = 'turn' | 'summarizer' | 'orchestrator';

export type TelemetryRecord = Readonly<{
  id: TelemetryRecordId;
  runId: ProviderRunId;
  sessionId: SessionId;
  kind: TelemetryKind;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cacheCreationInputTokens?: number;
  contextTokens?: number;
  estimatedCostUsd: number;
  recordedAt: IsoDateTime;
}>;
