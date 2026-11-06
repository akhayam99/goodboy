import type { AgentId, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';

export type AttentionTarget = Readonly<{
  workspaceId: WorkspaceId | null;
  sessionId: SessionId;
  reason: SessionAttentionReason | null;
  agentId: AgentId | null;
}>;
