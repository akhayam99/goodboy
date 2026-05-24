import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TelemetryRecordId } from './ids';
import type { ProviderName } from './provider';

export type TelemetryKind = 'turn' | 'summarizer';

export type TelemetryRecord = Readonly<{
  id: TelemetryRecordId;
  runId: ProviderRunId;
  sessionId: SessionId;
  // Agent that produced this turn. Nullable for historical records persisted
  // before m039; the counterfactual engine treats null as "unknown agent" and
  // groups them under a synthetic bucket.
  agentId: AgentId | null;
  kind: TelemetryKind;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheCreation5mTokens: number;
  cacheCreation1hTokens: number;
  estimatedCostUsd: number;
  recordedAt: IsoDateTime;
}>;
