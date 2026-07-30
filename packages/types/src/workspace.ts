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

export type WorkspaceKind = 'repo' | 'composite' | 'simple';

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
  | { kind: 'blocked'; runId: ProviderRunId; blockedAt: IsoDateTime }
  | { kind: 'error'; message: string; failedAt: IsoDateTime }
  | { kind: 'ended'; endedAt: IsoDateTime };

export type WorkflowTriggerMode = 'immediate' | 'manual' | 'after_run';

export type WorkflowExecutionMode = 'static' | 'dynamic';

export type WorkflowOrchestrationOutcome = 'done' | 'blocked';

export type WorkflowRun = Readonly<{
  id: WorkflowRunId;
  workflowId: WorkflowId;
  ordinal: number;
  currentStep: number;
  autoRun: boolean;
  triggerMode: WorkflowTriggerMode;
  executionMode: WorkflowExecutionMode;
  orchestrationOutcome?: WorkflowOrchestrationOutcome;
  chainAfterId?: WorkflowRunId;
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

export type WorkspaceIntegrationProvider = 'linear' | 'sentry' | 'gitlab';

export type LinearIntegrationConfig = Readonly<{
  workspaceUrlKey: string;
  viewerUserId: string;
  viewerName: string;
}>;

export type SentryIntegrationConfig = Readonly<{
  org: string;
  project: string;
  projectName?: string;
  orgName?: string;
}>;

export type GitlabIntegrationConfig = Readonly<{
  userName: string;
  userId: string;
  host: string;
}>;

export type WorkspaceIntegrationConfig =
  | LinearIntegrationConfig
  | SentryIntegrationConfig
  | GitlabIntegrationConfig;

type WorkspaceIntegrationBase = Readonly<{
  id: WorkspaceIntegrationId;
  workspaceId: WorkspaceId;
  credentialKey: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type LinearWorkspaceIntegration = WorkspaceIntegrationBase &
  Readonly<{
    provider: 'linear';
    config: LinearIntegrationConfig;
  }>;

export type SentryWorkspaceIntegration = WorkspaceIntegrationBase &
  Readonly<{
    provider: 'sentry';
    config: SentryIntegrationConfig;
  }>;

export type GitlabWorkspaceIntegration = WorkspaceIntegrationBase &
  Readonly<{
    provider: 'gitlab';
    config: GitlabIntegrationConfig;
  }>;

export type WorkspaceIntegration =
  | LinearWorkspaceIntegration
  | SentryWorkspaceIntegration
  | GitlabWorkspaceIntegration;

export type SessionExternalTaskProvider = 'linear' | 'sentry' | 'gitlab' | 'github';

export type SessionExternalTask = Readonly<{
  sessionId: SessionId;
  provider: SessionExternalTaskProvider;
  externalId: string;
  identifier: string;
  url: string;
  title: string;
  createdAt: IsoDateTime;
}>;
