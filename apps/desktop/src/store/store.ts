import { create } from 'zustand';
import { type FileConflict, type SlotKey } from '@goodboy/core';
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
  GoalAttachment,
  GoalAttachmentOwner,
  GlobalSettings,
  IsoDateTime,
  Message,
  OverrideSettings,
  OpenQuestion,
  OpenQuestionId,
  PlanConsumption,
  PlanId,
  PlanStatus,
  PlanWithCount,
  StepId,
  Session,
  SessionId,
  SessionBudget,
  SessionProviderPreference,
  StepDef,
  StepDefId,
  Workflow,
  WorkflowId,
  WorkflowRunId,
  WorkflowTriggerMode,
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
  SessionExternalTaskProvider,
  Workspace,
  WorkspaceId,
  WorkspaceIntegration,
  WorkspaceScript,
  WorkspaceScriptId,
  GhTokenStatus,
  PullRequestState,
  PrMergeMethod,
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
import type { ScriptRunResult, ScriptRunRecord } from '../features/scripts/scripts';
import { type WorkflowUpsertArgs, type StepDefUpsertArgs } from '../features/workflows/workflows';
import { type AgentKind } from '../features/session/agent-kind';
import type { TerminalTab, TerminalTabId, TerminalTabStatus } from '../shared/types/terminal';
import { createNotificationsSlice } from './slices/notifications';
import { createNudgesSlice } from './slices/nudges';
import { createPlansSlice } from './slices/plans';
import { createOpenQuestionsSlice } from './slices/open-questions';
import { createBudgetSlice } from './slices/budget';
import { createSkillsSlice } from './slices/skills';
import { createDiffCommentsSlice } from './slices/diff-comments';
import { createAttachmentsSlice } from './slices/attachments';
import { createGithubSlice } from './slices/github';
import { createGitlabMrSlice } from './slices/gitlab-mr';
import type { GitlabMergeRequest } from '../features/integrations/gitlab/client';
import { createIntegrationsSlice } from './slices/integrations';
import { createSidebarSlice } from './slices/sidebar';
import type { PanelSection } from './slices/sidebar/types';
import { createSessionViewSlice } from './slices/session-view';
import type { LensHistory, LensKind, SessionStudio } from './slices/session-view';
import { createTerminalSlice } from './slices/terminal';
import { createScriptsSlice } from './slices/scripts';
import { createPermissionsSlice } from './slices/permissions';
import {
  createProvidersSlice,
  INITIAL_LIFECYCLE_MAP,
  type ProviderLifecycleMap,
} from './slices/providers';
import { createAgentsSlice } from './slices/agents';
import type { DraftAttachment } from './slices/agents/setAgentAttachments';
import type { AgentQueuedTurn } from './slices/agents/setAgentQueue';
import { createWorkflowDraftsSlice } from './slices/workflowDrafts';
import type { WorkflowBuilderDraft } from './slices/workflowDrafts/types';
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
import { createPresenceSlice } from './slices/presence';
import { createTurnSlice } from './slices/turn';
import { createWorktreesSlice } from './slices/worktrees';
import { createBootSlice } from './slices/boot';
import { createUpdaterSlice } from './slices/updater';
import { initialUpdaterState, type UpdaterState } from './slices/updater/state';
import type { LinearViewer } from '../features/integrations/linear/client';
import type { SentryProject } from '../features/integrations/sentry/client';
import type { GitlabUser } from '../features/integrations/gitlab/client';

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

export type SystemAlert = {
  readonly id: string;
  readonly kind: SystemAlertKind;
  readonly message: string;
  readonly createdAt: string;
};

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

export type AppState = UpdaterState & {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly workspaceIntegrations: Readonly<
    Record<WorkspaceId, ReadonlyArray<WorkspaceIntegration>>
  >;
  readonly sessionExternalTasks: Readonly<Record<SessionId, SessionExternalTask>>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly windowPresence: Readonly<Record<string, WorkspaceId | null>>;
  readonly sessions: ReadonlyArray<Session>;
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
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly stepLibrary: Readonly<Record<WorkspaceId, ReadonlyArray<StepDef>>>;
  readonly sessionWorkflows: Readonly<Record<SessionId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  readonly agentRunHistory: Readonly<Record<AgentId, ReadonlyArray<ProviderRunId>>>;
  readonly agentTurnState: Readonly<Record<AgentId, TurnState>>;
  readonly sessionMergeConflicts: Readonly<Record<SessionId, ReadonlyArray<FileConflict>>>;
  readonly unknownPayloadCounts: Readonly<Record<string, number>>;
  readonly detectedEditors: ReadonlyArray<DetectedEditor>;
  readonly workspaceOverrides: Readonly<Record<WorkspaceId, OverrideSettings>>;
  readonly sessionOverrides: Readonly<Record<SessionId, OverrideSettings>>;
  readonly sidebarWorkspaceSearch: string;
  readonly sidebarSessionSearch: string;
  readonly unreadWorkspaceIds: ReadonlySet<WorkspaceId>;
  readonly sidebarStateFilter: ReadonlyArray<TurnState['kind']>;
  readonly sidebarProviderFilter: ReadonlyArray<ProviderId>;
  readonly sessionPanelExpanded: Readonly<
    Record<SessionId, Partial<Record<PanelSection, boolean>>>
  >;
  readonly githubStatus: GhTokenStatus | null;
  readonly sessionGithub: Readonly<Record<SessionId, SessionGithubState>>;
  readonly sessionGitlabMr: Readonly<Record<SessionId, SessionGitlabMrState>>;
  readonly sessionPendingResolutions: Readonly<Record<SessionId, ReadonlyArray<PendingResolution>>>;
  readonly volatilePermissionAllows: ReadonlySet<string>;
  readonly agentModelOverride: Readonly<Record<AgentId, string>>;
  readonly agentProviderOverride: Readonly<Record<AgentId, ProviderId>>;
  readonly agentEffortOverride: Readonly<Record<AgentId, string>>;
  readonly agentKindOverride: Readonly<Record<AgentId, AgentKind>>;
  readonly pendingResolverKickoff: Readonly<Record<AgentId, string>>;
  readonly resolverState: Readonly<Record<AgentId, 'awaiting' | 'committed' | 'wontfix'>>;
  readonly agentDraft: Readonly<Record<AgentId, string>>;
  readonly workflowDrafts: Readonly<Record<SessionId, WorkflowBuilderDraft | undefined>>;
  readonly agentAttachments: Readonly<Record<AgentId, ReadonlyArray<DraftAttachment>>>;
  readonly agentQueue: Readonly<Record<AgentId, ReadonlyArray<AgentQueuedTurn>>>;
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly sessionAttachments: Readonly<Record<SessionId, ReadonlyArray<GoalAttachment>>>;
  readonly workflowRunAttachments: Readonly<Record<WorkflowRunId, ReadonlyArray<GoalAttachment>>>;
  readonly notifications: ReadonlyArray<Notification>;
  readonly sessionPlans: Readonly<Record<SessionId, ReadonlyArray<PlanWithCount>>>;
  readonly planConsumptions: Readonly<Record<PlanId, ReadonlyArray<PlanConsumption>>>;
  readonly sessionOpenQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly sessionAnsweredQuestions: Readonly<Record<SessionId, ReadonlyArray<OpenQuestion>>>;
  readonly openQuestionScrollTarget: {
    readonly agentId: AgentId;
    readonly questionId: OpenQuestionId;
  } | null;
  readonly sessionNudges: Readonly<Record<SessionId, SessionNudge | null>>;
  readonly sessionLoading: Readonly<Record<SessionId, SessionLoadingFlags>>;
  readonly boardReady: boolean;
  readonly sessionsSidebarCollapsed: boolean;
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly lensHistory: Readonly<Record<SessionId, LensHistory>>;
  readonly workflowExpand: Readonly<Record<SessionId, Readonly<Record<string, boolean>>>>;
  readonly focusedWorkflowRunId: Readonly<Record<SessionId, string | null>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
  readonly focusedPlanId: Readonly<Record<SessionId, PlanId | null>>;
  readonly terminalSessions: Readonly<Record<SessionId, 'open' | 'closed'>>;
  readonly terminalTabs: Readonly<Record<SessionId, readonly TerminalTab[]>>;
  readonly activeTerminalTab: Readonly<Record<SessionId, TerminalTabId | null>>;
};

export type SessionLoadingFlags = {
  readonly agents: boolean;
  readonly transcript: boolean;
  readonly telemetry: boolean;
  readonly slots: boolean;
  readonly plans: boolean;
  readonly summary: boolean;
};

export type SessionGitlabMrState = {
  readonly mr: GitlabMergeRequest | null;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
};

export type SessionGithubState = {
  readonly pr: PullRequestState | null;
  readonly linkedIssues: ReadonlyArray<LinkedIssue>;
  readonly fetchedAt: IsoDateTime | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly detail: PrDetail | null;
  readonly detailFetchedAt: IsoDateTime | null;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
};

export type SummarizerSessionStatus = {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
  readonly lastUsage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly estimatedCostUsd: number;
  } | null;
  readonly lastAttempt: {
    readonly turnInput: string;
    readonly turnOutput: string;
  } | null;
};

export type AppActions = {
  hydrate(): Promise<void>;
  checkForUpdates(): Promise<void>;
  installUpdate(): Promise<void>;
  loadDetectedEditors(): Promise<void>;
  setCurrentWorkspace(id: WorkspaceId | null): Promise<void>;
  openWorkspace(id: WorkspaceId, title: string): Promise<void>;
  setWindowPresence(label: string, workspaceId: WorkspaceId | null): void;
  removeWindowPresence(label: string): void;
  setCurrentSession(id: SessionId | null): Promise<void>;
  refreshSessions(workspaceId: WorkspaceId): Promise<void>;
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
  addCompositeWorkspace(input: {
    name?: string;
    containerPath: string;
    members: ReadonlyArray<{ workspaceId: WorkspaceId; mountName: string }>;
  }): Promise<Workspace>;
  deleteWorkspace(id: WorkspaceId): Promise<void>;
  loadIntegrations(workspaceId: WorkspaceId): Promise<void>;
  connectLinear(workspaceId: WorkspaceId, token: string): Promise<LinearViewer>;
  disconnectLinear(workspaceId: WorkspaceId): Promise<void>;
  connectSentry(
    workspaceId: WorkspaceId,
    token: string,
    org: string,
    project: string,
  ): Promise<SentryProject>;
  disconnectSentry(workspaceId: WorkspaceId): Promise<void>;
  connectGitlab(workspaceId: WorkspaceId, host: string, token: string): Promise<GitlabUser>;
  disconnectGitlab(workspaceId: WorkspaceId): Promise<void>;
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
    externalTask?: {
      provider: SessionExternalTaskProvider;
      externalId: string;
      identifier: string;
      url: string;
      title: string;
    };
    mobileShared?: boolean;
  }): Promise<{ session: Session; worktree: CreatedWorktree }>;
  changeSessionBranch(
    sessionId: SessionId,
    args: { branch: string; createNew: boolean },
  ): Promise<void>;
  reconcileSessionBranch(sessionId: SessionId, observedBranch: string): Promise<void>;
  setSessionAutoRun(sessionId: SessionId, autoRun: boolean): Promise<void>;
  setWorkflowRunAutoRun(
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    autoRun: boolean,
  ): Promise<void>;
  startWorkflowRun(sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void>;
  attachWorkflowToSession(
    sessionId: SessionId,
    workflowId: WorkflowId,
    options?: {
      autoRun?: boolean;
      goal?: string;
      triggerMode?: WorkflowTriggerMode;
      chainAfterId?: WorkflowRunId;
    },
  ): Promise<void>;
  detachWorkflowFromSession(sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void>;
  discardWorkflow(sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void>;
  reorderSessionWorkflows(
    sessionId: SessionId,
    workflowRunIds: ReadonlyArray<WorkflowRunId>,
  ): Promise<void>;
  activateWorkflowAgent(
    sessionId: SessionId,
    agentId: AgentId,
    explicitPlanId?: PlanId,
    navigate?: boolean,
  ): Promise<void>;
  advanceClusterImplementation(
    sessionId: SessionId,
    childAgentId: AgentId,
    assistantText: string,
    opts?: { readonly force?: boolean },
  ): Promise<void>;
  finalizeWorkflowStep(
    sessionId: SessionId,
    agentId: AgentId,
    assistantText: string,
    planCapturedThisTurn: boolean,
    opts?: { readonly force?: boolean },
  ): Promise<{ readonly shouldAutoAdvance: boolean }>;
  advanceScoutTree(sessionId: SessionId, agentId: AgentId, assistantText: string): Promise<void>;
  forceAdvanceWorkflowStep(sessionId: SessionId, workflowRunId: WorkflowRunId): Promise<void>;
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
  loadPhaseTemplates(workspaceId: WorkspaceId): Promise<void>;
  savePhaseTemplate(template: WorkflowUpsertArgs): Promise<Workflow>;
  deleteWorkflow(id: WorkflowId, workspaceId: WorkspaceId): Promise<void>;
  loadStepLibrary(workspaceId: WorkspaceId): Promise<void>;
  saveStepDef(args: StepDefUpsertArgs, listWorkspaceId: WorkspaceId): Promise<void>;
  deleteStepDef(id: StepDefId, listWorkspaceId: WorkspaceId): Promise<void>;
  resetWorkflows(workspaceId: WorkspaceId): Promise<void>;
  loadPhaseRunsForSession(sessionId: SessionId): Promise<void>;
  selectAgent(sessionId: SessionId, agentId: AgentId): Promise<void>;
  deselectAgent(sessionId: SessionId): void;
  markAgentViewed(sessionId: SessionId, agentId: AgentId): Promise<void>;
  spawnAgent(
    sessionId: SessionId,
    args: {
      stepId?: StepId;
      workflowRunId?: WorkflowRunId;
      name?: string;
      model?: string;
      provider?: ProviderId;
      effort?: string;
      initialPrompt?: string;
      triggeredPlanId?: PlanId;
      kindOverride?: AgentKind;
      sourceThreadId?: string;
      sourceCommentUrl?: string;
      deferKickoff?: boolean;
    },
  ): Promise<AgentId>;
  activateNextResolver(sessionId: SessionId): Promise<void>;
  renameAgent(sessionId: SessionId, agentId: AgentId, name: string): Promise<void>;
  setAgentKind(agentId: AgentId, kind: AgentKind): void;
  setAgentEffortOverride(agentId: AgentId, effort: string): void;
  setAgentDraft(agentId: AgentId, value: string): void;
  clearAgentDraft(agentId: AgentId): void;
  setWorkflowDraft(sessionId: SessionId, draft: WorkflowBuilderDraft): void;
  clearWorkflowDraft(sessionId: SessionId): void;
  setAgentAttachments(agentId: AgentId, attachments: ReadonlyArray<DraftAttachment>): void;
  clearAgentAttachments(agentId: AgentId): void;
  setAgentQueue(agentId: AgentId, queue: ReadonlyArray<AgentQueuedTurn>): void;
  clearAgentQueue(agentId: AgentId): void;
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
  bulkDeleteTask(ids: ReadonlyArray<SessionId>): Promise<void>;
  archiveTask(sessionId: SessionId): Promise<void>;
  unarchiveTask(sessionId: SessionId): Promise<void>;
  bulkUnarchiveTask(ids: ReadonlyArray<SessionId>): Promise<void>;
  setSessionConfig(sessionId: SessionId, fields: SessionConfigUpdate): Promise<void>;
  setAgentConfig(sessionId: SessionId, agentId: AgentId, fields: AgentConfigUpdate): Promise<void>;
  setSidebarWorkspaceSearch(query: string): void;
  setSidebarSessionSearch(query: string): void;
  refreshUnreadWorkspaces(): Promise<void>;
  setSidebarStateFilter(states: ReadonlyArray<TurnState['kind']>): void;
  setSidebarProviderFilter(providers: ReadonlyArray<ProviderId>): void;
  setPanelSectionExpanded(sessionId: SessionId, section: PanelSection, expanded: boolean): void;
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
  mergePr(sessionId: SessionId, prNumber?: number, method?: PrMergeMethod): Promise<void>;
  refreshSessionMr(
    sessionId: SessionId,
    opts?: { force?: boolean; silent?: boolean },
  ): Promise<void>;
  createMrForSession(
    sessionId: SessionId,
    opts?: { title?: string; description?: string; targetBranch?: string; draft?: boolean },
  ): Promise<void>;
  mergeMrForSession(sessionId: SessionId): Promise<void>;
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
  loadGoalAttachments(owner: GoalAttachmentOwner): Promise<void>;
  addGoalAttachments(
    owner: GoalAttachmentOwner,
    inputs: ReadonlyArray<AttachmentInput>,
  ): Promise<void>;
  removeGoalAttachment(owner: GoalAttachmentOwner, id: string): Promise<void>;
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
  loadSessionOpenQuestions(sessionId: SessionId): Promise<void>;
  loadSessionAnsweredQuestions(sessionId: SessionId): Promise<void>;
  requestOpenQuestionScroll(target: { agentId: AgentId; questionId: OpenQuestionId }): void;
  clearOpenQuestionScroll(): void;
  answerOpenQuestions(
    sessionId: SessionId,
    pairs: ReadonlyArray<{ id: OpenQuestionId; text: string; answer: string }>,
    targetAgentId: AgentId | null,
  ): Promise<void>;
  dismissOpenQuestion(sessionId: SessionId, question: OpenQuestion): Promise<void>;
  restoreDismissedOpenQuestion(sessionId: SessionId, question: OpenQuestion): Promise<void>;
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
  setSessionsSidebarCollapsed(next: boolean): void;
  toggleSessionsSidebar(): void;
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
  setActiveLens(sessionId: SessionId, lens: LensKind | null): void;
  lensGo(sessionId: SessionId, delta: number): void;
  toggleWorkflowExpand(sessionId: SessionId, runId: string, defaultExpanded: boolean): void;
  setFocusedWorkflowRun(sessionId: SessionId, runId: string | null): void;
  setSessionStudio(sessionId: SessionId, studio: SessionStudio | null): void;
  setFocusedPlanId(sessionId: SessionId, planId: PlanId | null): void;
  openTerminal(sessionId: SessionId, cwd: string | null, cols: number, rows: number): Promise<void>;
  closeTerminal(sessionId: SessionId): Promise<void>;
  addTerminalTab(sessionId: SessionId, cwd: string | null): TerminalTabId;
  closeTerminalTab(sessionId: SessionId, tabId: TerminalTabId): void;
  setActiveTerminalTab(sessionId: SessionId, tabId: TerminalTabId): void;
  setTerminalTabStatus(sessionId: SessionId, tabId: TerminalTabId, status: TerminalTabStatus): void;
  closeSessionTerminals(sessionId: SessionId): void;
};

export type AppStore = AppState & AppActions;

export const initialState: AppState = {
  ...initialUpdaterState,
  workspaces: [],
  workspaceIntegrations: {},
  sessionExternalTasks: {},
  currentWorkspaceId: null,
  windowPresence: {},
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
  budgetRules: [],
  sessionBudgets: {},
  providerSpendBreakdown: [],
  budgetAlerts: [],
  skills: {},
  workspaceScripts: {},
  scriptRuns: {},
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
  sessionPanelExpanded: {},
  githubStatus: null,
  sessionGithub: {},
  sessionGitlabMr: {},
  sessionPendingResolutions: {},
  volatilePermissionAllows: new Set<string>(),
  agentModelOverride: {},
  agentProviderOverride: {},
  agentEffortOverride: {},
  agentKindOverride: {},
  pendingResolverKickoff: {},
  resolverState: {},
  agentDraft: {},
  workflowDrafts: {},
  agentAttachments: {},
  agentQueue: {},
  diffComments: {},
  sessionAttachments: {},
  workflowRunAttachments: {},
  notifications: [],
  sessionPlans: {},
  sessionNudges: {},
  planConsumptions: {},
  sessionOpenQuestions: {},
  sessionAnsweredQuestions: {},
  openQuestionScrollTarget: null,
  sessionLoading: {},
  boardReady: true,
  sessionsSidebarCollapsed: false,
  sessionViewPrefs: {},
  activeLens: {},
  lensHistory: {},
  focusedWorkflowRunId: {},
  workflowExpand: {},
  sessionStudio: {},
  focusedPlanId: {},
  terminalSessions: {},
  terminalTabs: {},
  activeTerminalTab: {},
};

export { summarizerQueues } from './turn-helpers';

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,
  ...createNotificationsSlice(set, get),
  ...createNudgesSlice(set, get),
  ...createPlansSlice(set, get),
  ...createOpenQuestionsSlice(set, get),
  ...createBudgetSlice(set, get),
  ...createSkillsSlice(set, get),
  ...createDiffCommentsSlice(set, get),
  ...createAttachmentsSlice(set, get),
  ...createGithubSlice(set, get),
  ...createGitlabMrSlice(set, get),
  ...createIntegrationsSlice(set, get),
  ...createSidebarSlice(set, get),
  ...createSessionViewSlice(set, get),
  ...createTerminalSlice(set, get),
  ...createScriptsSlice(set, get),
  ...createPermissionsSlice(set, get),
  ...createProvidersSlice(set, get),
  ...createAgentsSlice(set, get),
  ...createWorkflowDraftsSlice(set, get),
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
  ...createPresenceSlice(set, get),
  ...createTurnSlice(set, get),
  ...createWorktreesSlice(set, get),
  ...createBootSlice(set, get),
  ...createUpdaterSlice(set, get),
}));

export const useResolvedSettings = (sessionId: SessionId | null): ResolvedSettings => {
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
};
