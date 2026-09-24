import type {
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  WorkflowRunId,
  WorkspaceId,
} from './ids';
import type { ProviderName } from './provider';
import type { AgentRole, AgentStatus } from './workflow';

export type AgentTurnSpanEndReason = 'succeeded' | 'failed' | 'cancelled' | 'awaiting_user';

export type AgentTurnSpan = Readonly<{
  runId: ProviderRunId;
  agentId: AgentId;
  sessionId: SessionId;
  workspaceId: WorkspaceId;
  workflowRunId: WorkflowRunId | null;
  stepRole: AgentRole;
  provider: ProviderName;
  model: string;
  effort: string | null;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime;
  endReason: AgentTurnSpanEndReason;
}>;

export type MeasuredTurnSpan = Readonly<{
  agentId: AgentId;
  parentAgentId: AgentId | null;
  agentStatus: AgentStatus | null;
  workflowRunId: WorkflowRunId | null;
  isOrchestratedRunDone: boolean;
  stepRole: AgentRole;
  provider: ProviderName;
  model: string;
  effort: string | null;
  startedAtMs: number;
  endedAtMs: number;
  endReason: AgentTurnSpanEndReason;
  costUsd: number | null;
}>;

export type AgentTurnSpanRoute = Pick<
  AgentTurnSpan,
  'runId' | 'agentId' | 'provider' | 'model' | 'effort'
>;
