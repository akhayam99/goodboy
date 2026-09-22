import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryRecordId,
  WorkflowRunId,
} from './ids';
import type { ProviderName } from './provider';
import type { ProviderId } from './provider-registry';

export type TelemetryKind = 'turn' | 'summarizer' | 'orchestrator';

export type InvocationPurpose =
  'agent_turn' | 'orchestrator' | 'summarizer' | 'planner' | 'auxiliary';

export type UsageAttributionStatus = 'attributed' | 'unattributed';

export type InvocationLimits = Readonly<{
  global: number;
  provider: number;
  heavyweight: number;
}>;

export type InvocationContext = Readonly<{
  invocationId: string;
  workspaceId?: string;
  sessionId?: SessionId;
  workflowRunId?: WorkflowRunId;
  agentId?: AgentId;
  providerIdentity?: string;
  purpose: InvocationPurpose;
  isHeavyweight: boolean;
  limits: InvocationLimits;
  providerId?: ProviderId;
}>;

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
  invocationId?: string;
  workflowRunId?: WorkflowRunId;
  agentId?: AgentId;
  purpose?: InvocationPurpose;
  usageEventId?: string;
  attributionStatus?: UsageAttributionStatus;
}>;
