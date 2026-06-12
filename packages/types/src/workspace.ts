import type {
  IsoDateTime,
  ProviderRunId,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
  WorkspaceIntegrationId,
  WorkspaceScriptId,
} from './ids';
import type { SessionProviderPreference } from './provider-preference';
import type { ModelEffort } from './provider-registry';
import type { ClaudePermissionMode } from './permission';

export type WorkspaceKind = 'repo' | 'composite';

export type WorkspaceMember = Readonly<{
  workspaceId: WorkspaceId;
  rootPath: string;
  mountName: string;
}>;

export type Workspace = Readonly<{
  id: WorkspaceId;
  name: string;
  rootPath: string;
  kind?: WorkspaceKind;
  members?: ReadonlyArray<WorkspaceMember>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  disconnectedAt?: IsoDateTime;
  lastAccessedAt?: IsoDateTime;
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

export type WorkflowRun = Readonly<{
  id: WorkflowRunId;
  workflowId: WorkflowId;
  ordinal: number;
  currentStep: number;
  autoRun: boolean;
  goal?: string;
  discardedAt?: IsoDateTime;
}>;

export type Session = Readonly<{
  id: SessionId;
  workspaceId: WorkspaceId;
  goal: string;
  state: TurnState;
  contextSlots: ReadonlyArray<ContextSlot>;
  providerPreference: SessionProviderPreference;
  permissionMode: ClaudePermissionMode;
  workflowRuns: ReadonlyArray<WorkflowRun>;
  autoRun: boolean;
  titleUserEdited: boolean;
  archivedAt?: IsoDateTime;
  deletedAt?: IsoDateTime;
  verbosity?: 'brief' | 'normal' | 'verbose';
  effort?: ModelEffort;
  modelOverride?: string;
  providerOverride?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type WorkspaceScript = Readonly<{
  id: WorkspaceScriptId;
  workspaceId: WorkspaceId;
  name: string;
  body: string;
  sortOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type WorkspaceIntegrationProvider = 'linear';

export type LinearIntegrationConfig = Readonly<{
  workspaceUrlKey: string;
  viewerUserId: string;
  viewerName: string;
}>;

export type WorkspaceIntegration = Readonly<{
  id: WorkspaceIntegrationId;
  workspaceId: WorkspaceId;
  provider: WorkspaceIntegrationProvider;
  config: LinearIntegrationConfig;
  credentialKey: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type SessionExternalTaskProvider = 'linear';

export type SessionExternalTask = Readonly<{
  sessionId: SessionId;
  provider: SessionExternalTaskProvider;
  externalId: string;
  identifier: string;
  url: string;
  title: string;
  createdAt: IsoDateTime;
}>;
