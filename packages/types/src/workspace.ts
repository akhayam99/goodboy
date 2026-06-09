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
  /**
   * Set when the user "disconnects" the workspace. Soft delete: the row stays
   * in DB along with all sessions, transcripts, worktree refs. Reactivated by
   * adding a workspace pointing at the same `rootPath`.
   */
  disconnectedAt?: IsoDateTime;
  /** Last time this workspace was switched to or added. Used to rank recent workspaces. */
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

export type SessionUserStatus = 'wip' | 'waiting' | 'blocked' | 'done';

export type WorkflowRun = Readonly<{
  id: WorkflowRunId;
  workflowId: WorkflowId;
  ordinal: number;
  currentStep: number;
  autoRun: boolean;
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
  userStatus: SessionUserStatus;
  archivedAt?: IsoDateTime;
  deletedAt?: IsoDateTime;
  verbosity?: 'brief' | 'normal' | 'verbose';
  effort?: ModelEffort;
  modelOverride?: string;
  providerOverride?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

/**
 * A user-defined shell script attached to a workspace. Run manually by the
 * user from the Scripts panel — never executed by an agent.
 */
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

/**
 * Snapshot of the connected Linear account + workspace, cached locally so
 * "issues assigned to me" and URL building work without an extra /viewer
 * roundtrip on every fetch.
 */
export type LinearIntegrationConfig = Readonly<{
  /** URL slug of the Linear workspace, e.g. "serenis" → linear.app/serenis/... */
  workspaceUrlKey: string;
  /** Linear user id of the connected user. Used to filter "assigned to me". */
  viewerUserId: string;
  /** Display name of the connected user. Cached for UI. */
  viewerName: string;
}>;

export type WorkspaceIntegration = Readonly<{
  id: WorkspaceIntegrationId;
  workspaceId: WorkspaceId;
  provider: WorkspaceIntegrationProvider;
  config: LinearIntegrationConfig;
  /**
   * Key used to retrieve the provider API token from Tauri's credential store.
   * Format: `goodboy.workspace.<workspaceId>.<provider>`
   */
  credentialKey: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

/**
 * 1:1 link between a session and an external task (Linear issue today).
 * Lets us navigate from a session back to its source issue, snapshot title
 * for offline display, and pre-fill the goal at session creation.
 */
export type SessionExternalTaskProvider = 'linear';

export type SessionExternalTask = Readonly<{
  sessionId: SessionId;
  provider: SessionExternalTaskProvider;
  /** Internal Linear ID (UUID-like). Used for API calls. */
  externalId: string;
  /** Human-readable identifier, e.g. "SER-123". Used for display. */
  identifier: string;
  /** Direct URL into Linear, e.g. linear.app/serenis/issue/SER-123. */
  url: string;
  /** Snapshot of the issue title at link time. Refreshed on demand. */
  title: string;
  createdAt: IsoDateTime;
}>;
