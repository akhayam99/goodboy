import { create } from 'zustand';
import { type FileConflict, type NextAction, type SlotKey } from '@goodboy/core';
import {
  type SessionConfigUpdate,
  type AgentConfigUpdate,
  type Notification,
  type NotificationKind,
  type NotificationSeverity,
  type TelemetrySummary,
} from '@goodboy/db';
import type {
  Agent,
  AgentId,
  BudgetAlert,
  BudgetRule,
  ClaudePermissionMode,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  AttachmentInput,
  GlobalSettings,
  IsoDateTime,
  Message,
  OverrideSettings,
  OpenQuestion,
  PlanConsumption,
  PlanId,
  PlanStatus,
  PlanWithCount,
  StepId,
  Session,
  SessionId,
  SessionUserStatus,
  SessionBudget,
  SessionProviderPreference,
  StepDef,
  StepDefId,
  Workflow,
  WorkflowId,
  ProviderId,
  ProviderCredential,
  CredentialId,
  ProviderRunId,
  ResolvedSettings,
  VerbosityLevel,
  TurnState,
  Skill,
  SkillId,
  TelemetryRecord,
  TurnEvent,
  TurnProviderOverride,
  SessionExternalTask,
  Workspace,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceScript,
  WorkspaceScriptId,
  GhTokenStatus,
  PullRequestState,
  LinkedIssue,
  PrDetail,
  PendingResolution,
  SessionViewPrefs,
  SessionSortKey,
  SessionGroupKey,
} from '@goodboy/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/types';
import { resolveSettings } from '@goodboy/core';
import {
  buildProviderList,
  type ProviderAuthResults,
  type ProviderInfo,
  type ProviderStatus,
} from '../features/providers/providers';
import { type DetectedEditor } from '../shared/lib/editor';
import { DEFAULT_BRANCH_PREFIX } from '../features/settings/settings';
import { AGENT_FEATURES } from '../shared/lib/features';
import { type CreatedWorktree } from '../features/worktree/worktree';
import { type SkillUpsertArgs } from '../features/skills/skills';
import type {
  ScriptRunResult,
  ScriptRunRecord,
  ScriptResultState,
} from '../features/scripts/scripts';
import { type WorkflowUpsertArgs, type StepDefUpsertArgs } from '../features/workflows/workflows';
import { type AgentKind } from '../features/session/agent-kind';
import type { TerminalTab, TerminalTabId, TerminalTabStatus } from '../shared/types/terminal';
import { createNotificationsSlice } from './slices/notifications';
import { createNudgesSlice } from './slices/nudges';
import { createPlansSlice } from './slices/plans';
import { createBudgetSlice } from './slices/budget';
import { createSkillsSlice } from './slices/skills';
import { createDiffCommentsSlice } from './slices/diff-comments';
import { createGithubSlice } from './slices/github';
import { createIntegrationsSlice } from './slices/integrations';
import { createSidebarSlice } from './slices/sidebar';
import { createSessionViewSlice } from './slices/session-view';
import { createTerminalSlice } from './slices/terminal';
import { createScriptsSlice } from './slices/scripts';
import { createPermissionsSlice } from './slices/permissions';
import {
  createProvidersSlice,
  INITIAL_LIFECYCLE_MAP,
  type ProviderLifecycleMap,
} from './slices/providers';
import { createAgentsSlice } from './slices/agents';
import { createSlotsSlice } from './slices/slots';
import { createOverridesSlice } from './slices/overrides';
import { createCredentialsSlice } from './slices/credentials';
import { createWorkflowsSlice } from './slices/workflows';
import { createSettingsSlice } from './slices/settings';
import { createConflictsSlice } from './slices/conflicts';
import { createTranscriptsSlice } from './slices/transcripts';
import { createSummariesSlice } from './slices/summaries';
import { createSessionsSlice } from './slices/sessions';
import { createWorkspacesSlice } from './slices/workspaces';
import { createTurnSlice } from './slices/turn';
import { createWorktreesSlice } from './slices/worktrees';
import { createBootSlice } from './slices/boot';
import { createUpdaterSlice } from './slices/updater';
import { initialUpdaterState, type UpdaterState } from './slices/updater/state';
import type { LinearViewer } from '../features/integrations/linear/client';

export type BootPhase =
  | 'pending'
  | 'migrating'
  | 'loading-settings'
  | 'detecting-cli'
  | 'loading-workspaces'
  | 'restoring-session'
  | 'ready'
  | 'error';

export type SystemAlertKind = 'audit-retry-corrupt' | 'audit-retry-exhausted' | 'context-soft-cap';

export interface SystemAlert {
  readonly id: string;
  readonly kind: SystemAlertKind;
  readonly message: string;
  readonly createdAt: string;
}

export type SessionNudge =
  | {
      readonly kind: 'plan-ready';
      readonly id: string;
      readonly agentId: AgentId;
      readonly planId: PlanId | null;
      readonly planTitle: string;
    }
  | {
      readonly kind: 'handoff-suggested';
      readonly id: string;
      readonly agentId: AgentId;
      readonly targetKind: AgentKind;
      readonly reason: string;
      readonly planId: PlanId | null;
    }
  | {
      readonly kind: 'scout-fanout-suggested';
      readonly id: string;
      readonly agentId: AgentId;
      readonly workspaceId: WorkspaceId;
      readonly areaCount: number;
    };

import type { ProviderSpendEntry } from './slices/budget';
export type { ProviderSpendEntry };

export interface AppState extends UpdaterState {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceIntegrations: Readonly<
    Record<WorkspaceId, ReadonlyArray<WorkspaceIntegration>>
  >;
  /**
   * Per-session external task (Linear issue) snapshot. Hydrated on workspace
   * switch and refreshed when createSession links a fresh issue. Used by the
   * UI to show an "open in Linear" badge in the session header.
   */
  readonly sessionExternalTasks: Readonly<Record<SessionId, SessionExternalTask>>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Session>;
  // Archived sessions, loaded lazily per workspace when the user opens the
  // Archived tab. Kept separate from `sessions` so interactive surfaces
  // (palette, github polling, unread, workspace-switch eager loads) never see
  // them, they exist only as historical info.
  readonly archivedSessions: Readonly<Record<WorkspaceId, ReadonlyArray<Session>>>;
  readonly currentSessionId: SessionId | null;
  readonly settings: Readonly<Record<string, string>>;
  readonly sessionSummary: TelemetrySummary | null;
  readonly providerStatus: ProviderStatus | null;
  readonly cursorStatus: ProviderStatus | null;
  readonly codexStatus: ProviderStatus | null;
  readonly geminiStatus: ProviderStatus | null;
  readonly authResults: ProviderAuthResults | null;
  readonly providers: ReadonlyArray<ProviderInfo>;
  readonly providerLifecycle: ProviderLifecycleMap;
  readonly providerCredentials: ReadonlyArray<ProviderCredential>;
  readonly hydrated: boolean;
  readonly bootPhase: BootPhase;
  readonly error: string | null;
  readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  readonly messages: Readonly<Record<string, ReadonlyArray<Message>>>;
  readonly sessionWorktrees: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly sessionBranches: Readonly<Record<string, string>>;
  readonly sessionTelemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  readonly workspaceSummary: TelemetrySummary | null;
  readonly sessionSlots: Readonly<Record<string, ReadonlyArray<ContextSlot>>>;
  readonly slotHistory: Readonly<
    Record<string, Readonly<Record<string, ReadonlyArray<ContextSlotHistoryEntry>>>>
  >;
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
  readonly sessionNextActions: Readonly<Record<SessionId, ReadonlyArray<NextAction>>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly systemAlerts: ReadonlyArray<SystemAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly workspaceScripts: Readonly<Record<WorkspaceId, ReadonlyArray<WorkspaceScript>>>;
  readonly scriptRuns: Readonly<
    Record<SessionId, Readonly<Record<WorkspaceScriptId, ScriptRunRecord>>>
  >;
  readonly sessionScriptResult: Readonly<Record<SessionId, ScriptResultState | null>>;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly stepLibrary: Readonly<Record<WorkspaceId, ReadonlyArray<StepDef>>>;
  readonly sessionWorkflows: Readonly<Record<SessionId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  /**
   * Runtime history of providerRunIds per agent (Agent). Populated as turns
   * fire so the sidebar can aggregate telemetry across provider switches.
   * Agents whose `runId` only points at the *latest* provider run would
   * otherwise drop costs from previous providers when the user swaps mid-
   * session. Lives in-memory only; rebuilt from current state on hydrate.
   */
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly agentTurnState: Readonly<Record<AgentId, TurnState>>;
  readonly sessionMergeConflicts: Readonly<Record<SessionId, ReadonlyArray<FileConflict>>>;
  readonly unknownPayloadCounts: Readonly<Record<string, number>>;
  readonly detectedEditors: ReadonlyArray<DetectedEditor>;
  readonly workspaceOverrides: Readonly<Record<WorkspaceId, OverrideSettings>>;
  readonly sessionOverrides: Readonly<Record<SessionId, OverrideSettings>>;
  readonly sidebarWorkspaceSearch: string;
  readonly sidebarSessionSearch: string;
  // Workspaces with at least one agent whose terminal turn hasn't been viewed.
  // Refreshed from a DB aggregate so the workspace dot can pulse even for
  // workspaces whose sessions aren't currently loaded in memory.
  readonly unreadWorkspaceIds: ReadonlySet<WorkspaceId>;
  readonly sidebarStateFilter: ReadonlyArray<TurnState['kind']>;
  readonly sidebarProviderFilter: ReadonlyArray<ProviderId>;
  readonly githubStatus: GhTokenStatus | null;
  readonly sessionGithub: Readonly<Record<SessionId, SessionGithubState>>;
  // Review threads the user resolved locally but deferred publishing. Pushed
  // and resolved as a batch (single push) via pushAllResolutions. Loaded lazily
  // per session; undefined = not yet loaded.
  readonly sessionPendingResolutions: Readonly<Record<SessionId, ReadonlyArray<PendingResolution>>>;
  readonly volatilePermissionAllows: ReadonlySet<string>;
  readonly agentModelOverride: Readonly<Record<AgentId, string>>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
  // Per-agent input draft. Ephemeral, in-memory only (not persisted). Lets the
  // user keep an unsent composition when switching agents/sessions.
  readonly agentDraft: Readonly<Record<AgentId, string>>;
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly notifications: ReadonlyArray<Notification>;
  readonly sessionPlans: Readonly<Record<SessionId, ReadonlyArray<PlanWithCount>>>;
  readonly planConsumptions: Readonly<Record<PlanId, ReadonlyArray<PlanConsumption>>>;
  // Open questions cached per session so sidebar gates (PlanReadySuggestion,
  // AgentsSection's per-workflow NextStep CTA) can resolve their block state
  // without poking the DB on every render. Loaded lazily by setCurrentSession
  // and refreshed by autoPopulateContext when a turn either raises or
  // resolves a question. Mirrors the useOpenQuestions store but is keyed by
  // sessionId so the sidebar can show many sessions side-by-side.
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  /**
   * Per-session pending nudges surfaced to the chat input area. Cleared on
   * dismiss or when the user acts on the suggestion. Not persisted across
   * app restarts on purpose, nudges expire with the session lifetime.
   */
  readonly sessionNudges: Readonly<Record<SessionId, SessionNudge | null>>;
  /**
   * Per-session loading flags. Each block (agents, transcript, telemetry,
   * slots, plans, summary) starts true on session switch and is flipped off
   * as that block's async load resolves. UI uses these to render skeletons
   * without blocking the whole app on a single Promise.all.
   */
  readonly sessionLoading: Readonly<Record<SessionId, SessionLoadingFlags>>;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly terminalSessions: Readonly<Record<SessionId, 'open' | 'closed'>>;
  readonly terminalTabs: Readonly<Record<SessionId, readonly TerminalTab[]>>;
  readonly activeTerminalTab: Readonly<Record<SessionId, TerminalTabId | null>>;
}

export interface SessionLoadingFlags {
  readonly agents: boolean;
  readonly transcript: boolean;
  readonly telemetry: boolean;
  readonly slots: boolean;
  readonly plans: boolean;
  readonly summary: boolean;
}

export interface SessionGithubState {
  readonly pr: PullRequestState | null;
  readonly linkedIssues: ReadonlyArray<LinkedIssue>;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly detail: PrDetail | null;
  readonly detailFetchedAt: IsoDateTime | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
}

export interface SummarizerSessionStatus {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
  readonly lastUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
  } | null;
  // Inputs of the most recent (or in-flight) run. Retained on the 'error'
  // branch so the UI can re-trigger the same summarization; cleared on
  // 'idle' (success) so a stale retry can't fire after we've moved on.
  readonly lastAttempt: {
    readonly turnInput: string;
    readonly turnOutput: string;
  } | null;
}

export interface AppActions {
  hydrate(): Promise<void>;
  checkForUpdates(): Promise<void>;
  installUpdate(): Promise<void>;
  setCurrentWorkspace(id: WorkspaceId | null): Promise<void>;
  setCurrentSession(id: SessionId | null): Promise<void>;
  refreshSessions(workspaceId: WorkspaceId): Promise<void>;
  // Lazily load archived sessions for a workspace. Called when the Archived
  // tab opens. Idempotent: re-running refreshes the list (e.g. after the user
  // archived something new in another tab).
  loadArchivedSessions(workspaceId: WorkspaceId): Promise<void>;
  refreshSessionSummary(sessionId: SessionId): Promise<void>;
  loadSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string): Promise<void>;
  refreshProviderStatus(status: ProviderStatus): void;
  refreshProviders(): Promise<void>;
  installProvider(providerId: ProviderId): Promise<void>;
  loginProvider(providerId: ProviderId): Promise<void>;
  logoutProvider(providerId: ProviderId): Promise<void>;
  cancelProviderLifecycle(providerId: ProviderId): Promise<void>;
  addWorkspace(input: { rootPath: string; name?: string }): Promise<Workspace>;
  deleteWorkspace(id: WorkspaceId): Promise<void>;
  loadIntegrations(workspaceId: WorkspaceId): Promise<void>;
  connectLinear(workspaceId: WorkspaceId, token: string): Promise<LinearViewer>;
  disconnectLinear(workspaceId: WorkspaceId): Promise<void>;
  createSession(input: {
    workspaceId: WorkspaceId;
    goal: string;
    branchPrefix?: string;
    branchSlug?: string;
    existingBranch?: string;
    providerPreference?: SessionProviderPreference;
    workflowId?: WorkflowId;
    autoRun?: boolean;
    firstAgentKind?: AgentKind;
    firstAgentModel?: string;
    /**
     * Optional Linear issue to link to the new session. Stored in the
     * session_external_tasks table for navigation back to Linear, status
     * sync, etc. Set by the new-session dialog when the user picks an
     * issue from the autocomplete.
     */
    linearIssue?: {
      externalId: string;
      identifier: string;
      url: string;
      title: string;
    };
  }): Promise<{ session: Session; worktree: CreatedWorktree }>;
  changeSessionBranch(
    sessionId: SessionId,
    args: { branch: string; createNew: boolean },
  ): Promise<void>;
  reconcileSessionBranch(sessionId: SessionId, observedBranch: string): Promise<void>;
  setSessionAutoRun(sessionId: SessionId, autoRun: boolean): Promise<void>;
  attachWorkflowToSession(
    sessionId: SessionId,
    workflowId: WorkflowId,
    options?: { autoRun?: boolean },
  ): Promise<void>;
  detachWorkflowFromSession(sessionId: SessionId, workflowId: WorkflowId): Promise<void>;
  discardWorkflow(sessionId: SessionId, workflowId: WorkflowId): Promise<void>;
  reorderSessionWorkflows(
    sessionId: SessionId,
    workflowIds: ReadonlyArray<WorkflowId>,
  ): Promise<void>;
  setSessionUserStatus(sessionId: SessionId, status: SessionUserStatus): Promise<void>;
  activateWorkflowAgent(sessionId: SessionId, agentId: AgentId): Promise<void>;
  advanceClusterImplementation(
    sessionId: SessionId,
    childAgentId: AgentId,
    assistantText: string,
  ): Promise<void>;
  advanceScoutTree(sessionId: SessionId, agentId: AgentId, assistantText: string): Promise<void>;
  maybeAutoAdvanceWorkflow(sessionId: SessionId): Promise<void>;
  reprocessGoalForWorkflow(sessionId: SessionId): Promise<void>;
  loadTranscript(agentId: AgentId, sessionId: SessionId): Promise<void>;
  appendTurnEvent(agentId: AgentId, sessionId: SessionId, event: TurnEvent): void;
  resetTranscript(agentId: AgentId): void;
  sendTurn(input: {
    sessionId: SessionId;
    agentId?: AgentId;
    content: string;
    attachments?: ReadonlyArray<AttachmentInput>;
    override?: TurnProviderOverride;
    onNewAlerts?: (alerts: ReadonlyArray<BudgetAlert>) => void;
  }): Promise<void>;
  cancelCurrentTurn(sessionId: SessionId): Promise<void>;
  retrySummarizer(sessionId: SessionId): void;
  endSession(sessionId: SessionId): Promise<void>;
  refreshWorkspaceSummary(workspaceId: WorkspaceId): Promise<void>;
  loadSessionTelemetry(sessionId: SessionId): Promise<void>;
  loadSessionSlots(sessionId: SessionId): Promise<void>;
  upsertSessionSlot(sessionId: SessionId, key: SlotKey, value: string): Promise<void>;
  loadSlotHistory(sessionId: SessionId, key: SlotKey): Promise<void>;
  toggleSessionSlot(sessionId: SessionId, key: SlotKey, enabled: boolean): Promise<void>;
  loadBudgetRules(): Promise<void>;
  saveBudgetRule(rule: Omit<BudgetRule, 'id' | 'createdAt'>): Promise<void>;
  deleteBudgetRule(id: string): Promise<void>;
  loadSessionBudget(sessionId: SessionId): Promise<void>;
  setSessionBudget(sessionId: SessionId, softCapUsd: number): Promise<void>;
  refreshProviderSpendBreakdown(workspaceId: WorkspaceId): Promise<void>;
  loadBudgetAlerts(): Promise<void>;
  dismissBudgetAlert(id: string): Promise<void>;
  loadSkills(workspaceId: WorkspaceId): Promise<void>;
  saveSkill(input: SkillUpsertArgs): Promise<void>;
  deleteSkill(skillId: SkillId, workspaceId: WorkspaceId): Promise<void>;
  rescanSkills(workspaceId: WorkspaceId): Promise<void>;
  loadScripts(workspaceId: WorkspaceId): Promise<void>;
  saveScript(input: {
    workspaceId: WorkspaceId;
    id?: WorkspaceScriptId;
    name: string;
    body: string;
  }): Promise<void>;
  deleteScript(scriptId: WorkspaceScriptId, workspaceId: WorkspaceId): Promise<void>;
  runScript(
    sessionId: SessionId,
    scriptId: WorkspaceScriptId,
    cwd: string,
    cols?: number,
    rows?: number,
  ): Promise<ScriptRunResult>;
  cancelScript(sessionId: SessionId, scriptId: WorkspaceScriptId): Promise<void>;
  runWorkspaceScript(sessionId: SessionId, script: WorkspaceScript, cwd: string): Promise<void>;
  dismissScriptResult(sessionId: SessionId): void;
  loadPhaseTemplates(workspaceId: WorkspaceId): Promise<void>;
  savePhaseTemplate(template: WorkflowUpsertArgs): Promise<void>;
  deleteWorkflow(id: WorkflowId, workspaceId: WorkspaceId): Promise<void>;
  loadStepLibrary(workspaceId: WorkspaceId): Promise<void>;
  saveStepDef(args: StepDefUpsertArgs, listWorkspaceId: WorkspaceId): Promise<void>;
  deleteStepDef(id: StepDefId, listWorkspaceId: WorkspaceId): Promise<void>;
  resetWorkflows(workspaceId: WorkspaceId): Promise<void>;
  loadPhaseRunsForSession(sessionId: SessionId): Promise<void>;
  selectAgent(sessionId: SessionId, agentId: AgentId): Promise<void>;
  markAgentViewed(sessionId: SessionId, agentId: AgentId): Promise<void>;
  spawnAgent(
    sessionId: SessionId,
    args: {
      stepId?: StepId;
      name?: string;
      model?: string;
      effort?: string;
      initialPrompt?: string;
      triggeredPlanId?: PlanId;
      kindOverride?: AgentKind;
    },
  ): Promise<AgentId>;
  renameAgent(sessionId: SessionId, agentId: AgentId, name: string): Promise<void>;
  setAgentKind(agentId: AgentId, kind: AgentKind): void;
  setAgentDraft(agentId: AgentId, value: string): void;
  clearAgentDraft(agentId: AgentId): void;
  deleteAgent(sessionId: SessionId, agentId: AgentId): Promise<void>;
  wipeLocalDatabase(): Promise<void>;
  dismissSystemAlert(id: string): void;
  setSessionMergeConflicts(sessionId: SessionId, conflicts: ReadonlyArray<FileConflict>): void;
  resolveMergeConflicts(
    sessionId: SessionId,
    picks: Record<string, string>,
    runStatuses: ReadonlyArray<{ runId: string; completedAt: string; status: string }>,
  ): Promise<void>;
  loadWorkspaceOverrides(workspaceId: WorkspaceId): Promise<void>;
  setWorkspaceOverrides(workspaceId: WorkspaceId, overrides: OverrideSettings): Promise<void>;
  setWorkspaceProviderBinding(
    workspaceId: WorkspaceId,
    providerId: ProviderId,
    credentialId: string | null,
  ): Promise<void>;
  loadSessionOverrides(sessionId: SessionId): Promise<void>;
  setTaskOverrides(sessionId: SessionId, overrides: OverrideSettings): Promise<void>;
  loadCredentials(): Promise<void>;
  createCredential(
    providerId: ProviderId,
    label: string,
    apiKey: string,
  ): Promise<ProviderCredential>;
  deleteCredential(id: CredentialId): Promise<void>;
  renameCredential(id: CredentialId, label: string): Promise<void>;
  setAgentVerbosity(sessionId: SessionId, agentId: AgentId, level: VerbosityLevel): Promise<void>;
  renameTask(sessionId: SessionId, goal: string): Promise<void>;
  autoTitleSession(sessionId: SessionId, title: string): Promise<void>;
  deleteTask(sessionId: SessionId): Promise<void>;
  archiveTask(sessionId: SessionId): Promise<void>;
  unarchiveTask(sessionId: SessionId): Promise<void>;
  setSessionConfig(sessionId: SessionId, fields: SessionConfigUpdate): Promise<void>;
  setAgentConfig(sessionId: SessionId, agentId: AgentId, fields: AgentConfigUpdate): Promise<void>;
  setSidebarWorkspaceSearch(query: string): void;
  setSidebarSessionSearch(query: string): void;
  refreshUnreadWorkspaces(): Promise<void>;
  setSidebarStateFilter(states: ReadonlyArray<TurnState['kind']>): void;
  setSidebarProviderFilter(providers: ReadonlyArray<ProviderId>): void;
  exportConfig(): Promise<string | null>;
  importConfig(): Promise<import('@goodboy/types').ConfigBundleImportResult | null>;
  refreshGithubStatus(): Promise<void>;
  setGithubPat(token: string): Promise<GhTokenStatus>;
  clearGithubToken(): Promise<void>;
  refreshSessionPr(
    sessionId: SessionId,
    opts?: { force?: boolean; silent?: boolean; retries?: number },
  ): Promise<void>;
  refreshSessionPrDetail(
    sessionId: SessionId,
    opts?: { force?: boolean; silent?: boolean; retries?: number },
  ): Promise<void>;
  sweepGithub(opts?: { skipUnknownPr?: boolean }): void;
  resolveGithubThread(
    sessionId: SessionId,
    threadId: string,
    closure?: { commitSha?: string; reason?: string },
  ): Promise<boolean>;
  queueResolution(
    sessionId: SessionId,
    args: { threadId: string; commitSha: string; prNumber: number },
  ): Promise<void>;
  dequeueResolution(sessionId: SessionId, threadId: string): Promise<void>;
  loadPendingResolutions(sessionId: SessionId): Promise<void>;
  pushAllResolutions(
    sessionId: SessionId,
  ): Promise<{ pushed: boolean; resolved: number; failed: number }>;
  createPrForSession(
    sessionId: SessionId,
    opts?: { title?: string; body?: string; base?: string; draft?: boolean },
  ): Promise<void>;
  markPrReady(sessionId: SessionId, prNumber?: number): Promise<void>;
  convertPrToDraft(sessionId: SessionId, prNumber?: number): Promise<void>;
  mergePr(sessionId: SessionId, prNumber?: number): Promise<void>;
  closePr(sessionId: SessionId, prNumber?: number): Promise<void>;
  reopenPr(sessionId: SessionId, prNumber?: number): Promise<void>;
  editPr(
    sessionId: SessionId,
    prNumber: number,
    opts: { title?: string; body?: string },
  ): Promise<void>;
  requestReview(
    sessionId: SessionId,
    prNumber: number,
    reviewers: ReadonlyArray<string>,
  ): Promise<void>;
  clearSessionNextActions(sessionId: SessionId): void;
  resolvePermissionRequest(input: {
    sessionId: SessionId;
    agentId: AgentId;
    toolUseId: string;
    toolName: string;
    runId: ProviderRunId;
    scope: 'global' | 'workspace' | 'session' | 'once' | 'deny';
  }): Promise<void>;
  setSessionPermissionMode(sessionId: SessionId, mode: ClaudePermissionMode): Promise<void>;
  loadDiffComments(sessionId: SessionId): Promise<void>;
  addDiffComment(
    sessionId: SessionId,
    filePath: string,
    body: string,
    anchor?: import('@goodboy/types').DiffCommentAnchor,
  ): Promise<void>;
  resolveDiffComment(sessionId: SessionId, commentId: string): Promise<void>;
  consumeDiffComments(
    sessionId: SessionId,
    commentIds: ReadonlyArray<string>,
    agentId: AgentId,
  ): Promise<void>;
  reopenDiffComment(sessionId: SessionId, commentId: string): Promise<void>;
  deleteDiffComment(sessionId: SessionId, commentId: string): Promise<void>;
  loadNotifications(): Promise<void>;
  emitNotification(
    kind: NotificationKind,
    severity: NotificationSeverity,
    title: string,
    body?: string,
    opts?: { sessionId?: SessionId; workspaceId?: WorkspaceId },
  ): Promise<void>;
  markNotificationsRead(): Promise<void>;
  clearNotifications(): Promise<void>;
  loadSessionPlans(sessionId: SessionId): Promise<void>;
  setPlanStatus(sessionId: SessionId, planId: PlanId, status: PlanStatus): Promise<void>;
  updatePlanBody(
    sessionId: SessionId,
    planId: PlanId,
    title: string,
    bodyMd: string,
  ): Promise<void>;
  deletePlan(sessionId: SessionId, planId: PlanId): Promise<void>;
  restorePlan(sessionId: SessionId, planId: PlanId): Promise<void>;
  loadConsumptionsForPlan(planId: PlanId): Promise<void>;
  runPlan(sessionId: SessionId, planId: PlanId): Promise<void>;
  dismissSessionNudge(sessionId: SessionId, outcome?: 'accepted' | 'dismissed'): Promise<void>;
  acceptSessionNudgeHandoff(sessionId: SessionId): Promise<void>;
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
  openTerminal(sessionId: SessionId, cwd: string | null, cols: number, rows: number): Promise<void>;
  closeTerminal(sessionId: SessionId): Promise<void>;
  addTerminalTab(sessionId: SessionId, cwd: string | null): TerminalTabId;
  closeTerminalTab(sessionId: SessionId, tabId: TerminalTabId): void;
  setActiveTerminalTab(sessionId: SessionId, tabId: TerminalTabId): void;
  setTerminalTabStatus(sessionId: SessionId, tabId: TerminalTabId, status: TerminalTabStatus): void;
  closeSessionTerminals(sessionId: SessionId): void;
}

export type AppStore = AppState & AppActions;

export const initialState: AppState = {
  ...initialUpdaterState,
  workspaces: [],
  workspaceIntegrations: {},
  sessionExternalTasks: {},
  currentWorkspaceId: null,
  sessions: [],
  archivedSessions: {},
  currentSessionId: null,
  settings: {},
  sessionSummary: null,
  providerStatus: null,
  cursorStatus: null,
  codexStatus: null,
  geminiStatus: null,
  authResults: null,
  providers: buildProviderList({ anthropic: null, cursor: null, codex: null, gemini: null }),
  providerLifecycle: INITIAL_LIFECYCLE_MAP,
  providerCredentials: [],
  hydrated: false,
  bootPhase: 'pending',
  error: null,
  transcripts: {},
  messages: {},
  sessionWorktrees: {},
  sessionBranches: {},
  sessionTelemetry: {},
  workspaceSummary: null,
  sessionSlots: {},
  slotHistory: {},
  summarizerStatus: {},
  sessionNextActions: {},
  budgetRules: [],
  sessionBudgets: {},
  providerSpendBreakdown: [],
  budgetAlerts: [],
  skills: {},
  workspaceScripts: {},
  scriptRuns: {},
  sessionScriptResult: {},
  phaseTemplates: {},
  stepLibrary: {},
  sessionWorkflows: {},
  sessionPhaseRuns: {},
  selectedAgentId: {},
  agentRunHistory: {},
  agentTurnState: {},
  sessionMergeConflicts: {},
  unknownPayloadCounts: {},
  detectedEditors: [],
  systemAlerts: [],
  workspaceOverrides: {},
  sessionOverrides: {},
  sidebarWorkspaceSearch: '',
  sidebarSessionSearch: '',
  unreadWorkspaceIds: new Set<WorkspaceId>(),
  sidebarStateFilter: [],
  sidebarProviderFilter: [],
  githubStatus: null,
  sessionGithub: {},
  sessionPendingResolutions: {},
  volatilePermissionAllows: new Set<string>(),
  agentModelOverride: {},
  agentKindOverride: {},
  agentDraft: {},
  diffComments: {},
  notifications: [],
  sessionPlans: {},
  sessionNudges: {},
  planConsumptions: {},
  sessionOpenQuestions: {},
  sessionLoading: {},
  sessionViewPrefs: {},
  terminalSessions: {},
  terminalTabs: {},
  activeTerminalTab: {},
};

// Re-exported so existing test imports (`import { summarizerQueues } from './store'`)
// keep working after the turn helpers moved out of this file.
export { summarizerQueues } from './turn-helpers';

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  ...createNotificationsSlice(set, get),
  ...createNudgesSlice(set, get),
  ...createPlansSlice(set, get),
  ...createBudgetSlice(set, get),
  ...createSkillsSlice(set, get),
  ...createDiffCommentsSlice(set, get),
  ...createGithubSlice(set, get),
  ...createIntegrationsSlice(set, get),
  ...createSidebarSlice(set, get),
  ...createSessionViewSlice(set, get),
  ...createTerminalSlice(set, get),
  ...createScriptsSlice(set, get),
  ...createPermissionsSlice(set, get),
  ...createProvidersSlice(set, get),
  ...createAgentsSlice(set, get),
  ...createSlotsSlice(set, get),
  ...createOverridesSlice(set, get),
  ...createCredentialsSlice(set, get),
  ...createWorkflowsSlice(set, get),
  ...createSettingsSlice(set, get),
  ...createConflictsSlice(set, get),
  ...createTranscriptsSlice(set, get),
  ...createSummariesSlice(set, get),
  ...createSessionsSlice(set, get),
  ...createWorkspacesSlice(set, get),
  ...createTurnSlice(set, get),
  ...createWorktreesSlice(set, get),
  ...createBootSlice(set, get),
  ...createUpdaterSlice(set, get),
}));

export function useResolvedSettings(sessionId: SessionId | null): ResolvedSettings {
  return useAppStore((state) => {
    const session = sessionId ? (state.sessions.find((s) => s.id === sessionId) ?? null) : null;
    const workspaceId = session?.workspaceId ?? null;

    const globalSettings: GlobalSettings = {
      defaultProviderId: DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
      defaultWorkflowId: null,
      defaultBranchPrefix: DEFAULT_BRANCH_PREFIX,
      parallelEnabled: AGENT_FEATURES.parallelAgents,
      defaultVerbosity: 'normal',
    };

    const workspaceOverride = workspaceId ? (state.workspaceOverrides[workspaceId] ?? null) : null;
    const sessionOverride = sessionId ? (state.sessionOverrides[sessionId] ?? null) : null;

    return resolveSettings({ global: globalSettings, workspaceOverride, sessionOverride });
  });
}
