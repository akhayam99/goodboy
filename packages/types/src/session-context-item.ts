import type { AgentId, IsoDateTime, SessionContextItemId, SessionId, WorkspaceId } from './ids';
import type { AgentRole } from './workflow';

export type SessionContextItemKind = 'learning' | 'note';

export type SessionContextItemStatus = 'active' | 'dismissed';

export type SessionContextItemSource = Readonly<{
  role: AgentRole;
  agentId: AgentId | null;
  turnStart: number;
  turnEnd: number;
}>;

export type SessionContextItemDraft = Readonly<{
  id: SessionContextItemId;
  sessionId: SessionId;
  workspaceId: WorkspaceId;
  kind: SessionContextItemKind;
  title: string;
  text: string;
  topic: string | null;
  source: SessionContextItemSource | null;
  audience: ReadonlyArray<AgentRole>;
  status: SessionContextItemStatus;
  createdAt: IsoDateTime;
}>;

export type SessionContextItem = Omit<SessionContextItemDraft, 'sessionId'> &
  Readonly<{
    sessionId: SessionId | null;
    projectName: string | null;
    isSessionDeleted: boolean;
    updatedAt: IsoDateTime;
  }>;
