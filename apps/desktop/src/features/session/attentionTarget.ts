import type {
  AgentId,
  MountId,
  SessionAttentionReason,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { NotificationPlaceReason } from './notificationPlaceReason';

export type AttentionExactPlace = Readonly<{
  reason: NotificationPlaceReason;
  mountId: MountId | null;
  subject?: 'note' | 'comment';
}>;

export type AttentionTarget = Readonly<{
  workspaceId: WorkspaceId | null;
  sessionId: SessionId;
  reason: SessionAttentionReason | null;
  agentId: AgentId | null;
  place?: AttentionExactPlace;
}>;
