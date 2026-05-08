import type { IsoDateTime, ProviderRunId, TaskId, TelemetryRecordId } from './ids';
import type { ProviderName } from './provider';

export type TelemetryKind = 'turn' | 'summarizer';

export type TelemetryRecord = Readonly<{
  id: TelemetryRecordId;
  runId: ProviderRunId;
  taskId: TaskId;
  kind: TelemetryKind;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  recordedAt: IsoDateTime;
}>;
