import type { IsoDateTime, ProviderRunId, SessionId, WorkflowId, WorkspaceId } from './ids';
import type { SessionProviderPreference } from './provider-preference';
import type { ClaudePermissionMode } from './permission';

export type Workspace = Readonly<{
  id: WorkspaceId;
  name: string;
  rootPath: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /**
   * Set when the user "disconnects" the workspace. Soft delete: the row stays
   * in DB along with all sessions, transcripts, worktree refs. Reactivated by
   * adding a workspace pointing at the same `rootPath`.
   */
  disconnectedAt?: IsoDateTime;
}>;

export type ContextSlot = Readonly<{
  key: string;
  value: string;
  enabled: boolean;
}>;

export type ContextSlotAuthor = 'user' | 'summarizer';

export type ContextSlotHistoryEntry = Readonly<{
  id: string;
  key: string;
  value: string;
  author: ContextSlotAuthor;
  createdAt: IsoDateTime;
}>;

export type TurnState =
  | { kind: 'draft' }
  | { kind: 'starting'; startedAt: IsoDateTime }
  | { kind: 'idle'; lastActivityAt: IsoDateTime }
  | { kind: 'running'; runId: ProviderRunId; startedAt: IsoDateTime }
  | { kind: 'error'; message: string; failedAt: IsoDateTime }
  | { kind: 'ended'; endedAt: IsoDateTime };

export type SessionUserStatus = 'wip' | 'waiting' | 'blocked' | 'done';

export type Session = Readonly<{
  id: SessionId;
  workspaceId: WorkspaceId;
  goal: string;
  state: TurnState;
  contextSlots: ReadonlyArray<ContextSlot>;
  providerPreference: SessionProviderPreference;
  permissionMode: ClaudePermissionMode;
  workflowId?: WorkflowId;
  currentStepOrdinal?: number;
  autoRun: boolean;
  titleUserEdited: boolean;
  skipInit: boolean;
  userStatus: SessionUserStatus;
  archivedAt?: IsoDateTime;
  deletedAt?: IsoDateTime;
  verbosity?: 'brief' | 'normal' | 'verbose';
  effort?: 'low' | 'medium' | 'high' | 'extra-high' | 'max';
  modelOverride?: string;
  providerOverride?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type WorkspaceInitScript = Readonly<{
  id: string;
  workspaceId: WorkspaceId;
  content: string;
  createdAt: IsoDateTime;
}>;
