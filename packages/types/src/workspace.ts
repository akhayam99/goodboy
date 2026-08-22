import type {
  IntegrationCredentialId,
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
import type { ModelEffort, ProviderId } from './provider-registry';
import type { ClaudePermissionMode } from './permission';
import type { RoleModelPreferences } from './settings';
import type { GitDistance, GitOperation, GitWorkingTree } from './worktree';

export type WorkspaceKind = 'repo' | 'composite' | 'simple';

export type WorkspaceGitState = 'missing' | 'absent' | 'unborn' | 'ready';

export type WorkspaceGitStatus = Readonly<{
  state: WorkspaceGitState;
  branch: string | null;
  headSubject: string | null;
  upstreamDistance: GitDistance;
  workingTree: GitWorkingTree;
  upstream: string | null;
  inProgress: GitOperation | null;
}>;

export type WorkspaceMember = Readonly<{
  workspaceId: WorkspaceId;
  rootPath: string;
  mountName: string;
}>;

export type SessionMount = Readonly<{
  workspaceId: WorkspaceId;
  mountName: string;
  worktreePath: string;
  repoRoot: string;
  branch: string;
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

export type WorkflowOrchestrationStopKind = 'failure' | 'budget' | 'questions' | 'operator';

export type WorkflowOrchestrationStop = Readonly<{
  kind: WorkflowOrchestrationStopKind;
  message: string;
}>;

export type WorkflowSpendLimitMode = 'notify' | 'pause';

export type OrchestratorRouting = Readonly<{
  providerId: ProviderId;
  model: string;
  effort?: ModelEffort;
}>;

export type WorkflowRun = Readonly<{
  id: WorkflowRunId;
  workflowId: WorkflowId;
  ordinal: number;
  currentStep: number;
  autoRun: boolean;
  triggerMode: WorkflowTriggerMode;
  executionMode: WorkflowExecutionMode;
  orchestrationOutcome?: WorkflowOrchestrationOutcome;
  orchestrationReason?: string;
  orchestrationStop?: WorkflowOrchestrationStop;
  orchestratorHints?: string;
  orchestratorSummary?: string;
  orchestratorRouting?: OrchestratorRouting;
  roleModelOverrides?: RoleModelPreferences;
  spendLimitUsd?: number;
  spendLimitMode?: WorkflowSpendLimitMode;
  chainAfterId?: WorkflowRunId;
  goal?: string;
  discardedAt?: IsoDateTime;
  createdAt?: IsoDateTime;
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
  activeMountWorkspaceId?: WorkspaceId;
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

export type WorkspaceIntegrationProvider =
  'linear' | 'sentry' | 'gitlab' | 'jira' | 'bitbucket' | 'slack';

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

export type JiraIntegrationConfig = Readonly<{
  siteUrl: string;
  email: string;
  projectKey: string;
  accountId?: string;
  displayName?: string;
}>;

export type BitbucketIntegrationConfig = Readonly<{
  workspaceSlug: string;
  email: string;
  workspaceName?: string;
  accountId?: string;
  displayName?: string;
}>;

export type SlackIntegrationConfig = Readonly<{
  teamId: string;
  teamName: string;
  botUserId: string;
  botUserName?: string;
}>;

export type WorkspaceIntegrationConfig =
  | LinearIntegrationConfig
  | SentryIntegrationConfig
  | GitlabIntegrationConfig
  | JiraIntegrationConfig
  | BitbucketIntegrationConfig
  | SlackIntegrationConfig;

type WorkspaceIntegrationBase = Readonly<{
  id: WorkspaceIntegrationId;
  workspaceId: WorkspaceId;
  credentialId: IntegrationCredentialId;
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

export type JiraWorkspaceIntegration = WorkspaceIntegrationBase &
  Readonly<{
    provider: 'jira';
    config: JiraIntegrationConfig;
  }>;

export type BitbucketWorkspaceIntegration = WorkspaceIntegrationBase &
  Readonly<{
    provider: 'bitbucket';
    config: BitbucketIntegrationConfig;
  }>;

export type SlackWorkspaceIntegration = WorkspaceIntegrationBase &
  Readonly<{
    provider: 'slack';
    config: SlackIntegrationConfig;
  }>;

export type WorkspaceIntegration =
  | LinearWorkspaceIntegration
  | SentryWorkspaceIntegration
  | GitlabWorkspaceIntegration
  | JiraWorkspaceIntegration
  | BitbucketWorkspaceIntegration
  | SlackWorkspaceIntegration;

export type SessionExternalTaskProvider =
  'linear' | 'sentry' | 'gitlab' | 'github' | 'jira' | 'bitbucket' | 'slack';

export const SESSION_EXTERNAL_TASK_PROVIDERS = [
  'linear',
  'sentry',
  'gitlab',
  'github',
  'jira',
  'bitbucket',
  'slack',
] satisfies ReadonlyArray<SessionExternalTaskProvider>;

export const isSessionExternalTaskProvider = (
  value: unknown,
): value is SessionExternalTaskProvider =>
  typeof value === 'string' &&
  SESSION_EXTERNAL_TASK_PROVIDERS.some((provider) => provider === value);

export type SessionExternalTask = Readonly<{
  sessionId: SessionId;
  mountWorkspaceId?: WorkspaceId;
  branch?: string;
  provider: SessionExternalTaskProvider;
  externalId: string;
  identifier: string;
  url: string;
  title: string;
  createdAt: IsoDateTime;
}>;
