import type { IsoDateTime, ProviderRunId, SessionId, TelemetryRecordId } from './ids';
import type { ProviderName } from './provider';

export type TelemetryRecord = Readonly<{
  id: TelemetryRecordId;
  runId: ProviderRunId;
  sessionId: SessionId;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  recordedAt: IsoDateTime;
}>;
