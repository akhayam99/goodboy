import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  WorkflowPropagator,
  PermissionEngine,
  buildClaudeFlags,
  autoPopulateContext,
  buildStepPrompt,
  currentStep,
  findReusableSession,
  parseSlashCommand,
  resolveConflicts,
  resolveSettings,
  turnReducer,
  Summarizer,
  type ClaudeFlagSet,
  type FileConflict,
  type NextAction,
  type SlotKey,
  seedWorkflowLibrary,
} from '@kay-am/core';
import {
  getSetting,
  insertMessage,
  insertProviderRun,
  insertTask,
  insertTaskWorktree,
  insertTelemetry,
  insertTurnEvent,
  insertWorkspace,
  deleteWorkspace,
  listContextSlotsForTask,
  insertContextSlotHistory,
  listContextSlotHistory,
  listMessagesForAgent,
  listMessagesForTask,
  listTurnEventsForAgent,
  listTurnEventsForTask,
  listAgentRunIdsForTask,
  listTasksForWorkspace,
  listTelemetryForTask,
  listWorkspaces,
  listWorktreesForTask,
  deleteWorktreesForTask,
  updateTaskWorktreeBranch,
  listAllTaskWorktrees,
  renameTask as renameSessionInDb,
  deleteTask as deleteSessionFromDb,
  setSetting as dbSetSetting,
  summarizeTaskTelemetry,
  summarizeWorkspaceTelemetry,
  summarizeWorkspaceProviderTelemetry,
  updateProviderRunStatus,
  updateTaskPermissionMode,
  updateTaskAutoRun,
  updateTaskTitleUserEdited,
  updateTaskState,
  upsertContextSlot,
  insertDiffComment,
  listDiffCommentsForTask,
  resolveDiffComment as dbResolveDiffComment,
  deleteDiffComment as dbDeleteDiffComment,
  insertNotification,
  listNotifications,
  markAllNotificationsRead,
  clearAllNotifications,
  type Notification,
  type NotificationKind,
  type NotificationSeverity,
  type TelemetrySummary,
  type ProviderTelemetrySummary,
} from '@kay-am/db';
import type {
  BudgetAlert,
  BudgetRule,
  ClaudePermissionMode,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  GlobalSettings,
  IsoDateTime,
  Message,
  MessageId,
  OverrideSettings,
  PermissionDecision,
  PermissionDecisionKind,
  PermissionRequest,
  PermissionRequestId,
  PermissionRule,
  Plan,
  PlanId,
  PlanStatus,
  Step,
  StepId,
  Session,
  SessionId,
  SessionStatus,
  Workflow,
  WorkflowId,
  ProviderId,
  ProviderRun,
  ProviderRunId,
  ResolvedSettings,
  Task,
  TaskBudget,
  TaskId,
  TaskProviderPreference,
  TurnState,
  Skill,
  SkillId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  TurnProviderOverride,
  Workspace,
  WorkspaceId,
  GhTokenStatus,
  PullRequestState,
  LinkedIssue,
  PrDetail,
} from '@kay-am/types';
import { DEFAULT_TASK_PROVIDER_PREFERENCE } from '@kay-am/types';
import {
  computeCostUsd,
  computeCodexCostUsd,
  computeCursorCostUsd,
  extractPlanFromMarker,
  getPrForBranch,
  fetchLinkedIssues,
  fetchPrDetail,
  detectRepoSlug,
} from '@kay-am/core';
import { invokeSessionBudgetGet, invokeSessionBudgetSet } from '../budget';
import { runDbMigrations, tauriDatabase, wipeDb } from '../db';
import {
  ghStatus,
  ghSetToken,
  ghClearToken,
  tauriGhRunner,
  createTauriPrCacheStore,
} from '../github';
import {
  buildProviderList,
  checkProviderAuth,
  getCursorStatus,
  getCodexStatus,
  getProviderStatus,
  type ProviderAuthResults,
  type ProviderInfo,
  type ProviderStatus,
  type ProviderStatuses,
} from '../providers';
import { detectEditors, type DetectedEditor } from '../editor';
import { validateGitRepo } from '../repo';
import { resolveProviderForTurn } from '../routing';
import {
  SETTING_EDITOR_BINARY,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  SETTING_ENABLE_PARALLEL_AGENTS,
  SETTING_MAX_PARALLELISM,
  DEFAULT_BRANCH_PREFIX,
  DEFAULT_ENABLE_PARALLEL_AGENTS,
  DEFAULT_MAX_PARALLELISM,
  MAX_PARALLELISM,
  MIN_PARALLELISM,
} from '../settings';
import { getCodexPriceOverride, refreshPricingTable } from '../provider-pricing';
import { runTurn, cancelTurn, encodeAuthRequiredMessage, isAuthErrorMessage } from '../turn';
import { readVerbosity, verbosityDirective } from '../verbosity';
import {
  createWorktree,
  removeWorktree,
  changeWorktreeBranch,
  type CreatedWorktree,
} from '../worktree';
import {
  invokeBudgetRuleList,
  invokeBudgetRuleUpsert,
  invokeBudgetRuleDelete,
  invokeBudgetAlertsList,
  invokeBudgetAlertDismiss,
} from '../budget';
import {
  invokeSkillList,
  invokeSkillUpsert,
  invokeSkillDelete,
  invokeSkillRescan,
  resolveSkillInvocation,
  type SkillUpsertArgs,
} from '../skills';
import {
  invokePermissionRuleList,
  invokePermissionRuleUpsert,
  invokePermissionAuditInsert,
  invokeAuditRetryEnqueue,
  invokeAuditRetryDrain,
  invokeAuditRetryUpdate,
  invokeAuditRetryDelete,
  type AuditRetryEntry,
  type PermissionAuditInsertPayload,
} from '../permissions';
import {
  invokePhaseTemplateList,
  invokePhaseTemplateUpsert,
  invokePhaseTemplateDelete,
  invokePhaseRunList,
  invokePhaseRunInsert,
  invokePhaseRunUpdateStatus,
  invokeSessionSetProviderSessionId,
  type PhaseTemplateUpsertArgs,
} from '../phases';
import {
  detectParallelGroup,
  runParallelBranch,
  type ParallelBranchEffects,
} from './parallel-turn';
import { exportConfigToFile, importConfigFromFile } from '../config-export';
import { formatError } from '../errors';
import { AGENT_KIND_DEFAULTS, inferAgentKindFromName, type AgentKind } from '../agent-kind';
import {
  deletePlan as invokeDeletePlan,
  listPlansForSession as invokeListPlansForSession,
  setPlanBody as invokeSetPlanBody,
  setPlanStatus as invokeSetPlanStatus,
  upsertPlan as invokeUpsertPlan,
} from '../plans';
import { slotsForKind } from '../slot-routing';
import { estimateTokens } from '../utils/estimate-tokens';

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

import { buildContextPreamble, buildPriorTurnsBlock, getModelContextWindow } from './preamble';

function toRelPath(absPath: string, workingDir: string): string {
  if (!workingDir) return absPath;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  return absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
}

export interface AppState {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Task>;
  readonly currentSessionId: TaskId | null;
  readonly settings: Readonly<Record<string, string>>;
  readonly sessionSummary: TelemetrySummary | null;
  readonly providerStatus: ProviderStatus | null;
  readonly cursorStatus: ProviderStatus | null;
  readonly codexStatus: ProviderStatus | null;
  readonly authResults: ProviderAuthResults | null;
  readonly providers: ReadonlyArray<ProviderInfo>;
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
  readonly sessionNextActions: Readonly<Record<TaskId, ReadonlyArray<NextAction>>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<TaskId, TaskBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly systemAlerts: ReadonlyArray<SystemAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<TaskId, ReadonlyArray<Session>>>;
  readonly selectedAgentId: Readonly<Record<TaskId, SessionId | null>>;
  /**
   * Runtime history of providerRunIds per agent (Session). Populated as turns
   * fire so the sidebar can aggregate telemetry across provider switches —
   * agents whose `runId` only points at the *latest* provider run would
   * otherwise drop costs from previous providers when the user swaps mid-
   * session. Lives in-memory only; rebuilt from current state on hydrate.
   */
  readonly agentRunHistory: Readonly<Record<SessionId, ReadonlyArray<ProviderRunId>>>;
  readonly agentTurnState: Readonly<Record<SessionId, TurnState>>;
  readonly sessionMergeConflicts: Readonly<Record<TaskId, ReadonlyArray<FileConflict>>>;
  readonly unknownPayloadCounts: Readonly<Record<string, number>>;
  readonly detectedEditors: ReadonlyArray<DetectedEditor>;
  readonly workspaceOverrides: Readonly<Record<WorkspaceId, OverrideSettings>>;
  readonly sessionOverrides: Readonly<Record<TaskId, OverrideSettings>>;
  readonly sidebarWorkspaceSearch: string;
  readonly sidebarSessionSearch: string;
  readonly sidebarStateFilter: ReadonlyArray<TurnState['kind']>;
  readonly sidebarProviderFilter: ReadonlyArray<ProviderId>;
  readonly githubStatus: GhTokenStatus | null;
  readonly sessionGithub: Readonly<Record<TaskId, SessionGithubState>>;
  readonly volatilePermissionAllows: ReadonlySet<string>;
  readonly agentModelOverride: Readonly<Record<SessionId, string>>;
  readonly agentKindOverride: Readonly<Record<SessionId, AgentKind>>;
  // Per-agent input draft. Ephemeral, in-memory only (not persisted). Lets the
  // user keep an unsent composition when switching agents/sessions.
  readonly agentDraft: Readonly<Record<SessionId, string>>;
  readonly diffComments: Readonly<Record<string, ReadonlyArray<DiffComment>>>;
  readonly notifications: ReadonlyArray<Notification>;
  readonly sessionPlans: Readonly<Record<TaskId, ReadonlyArray<Plan>>>;
  /**
   * Per-session loading flags. Each block (agents, transcript, telemetry,
   * slots, plans, summary) starts true on session switch and is flipped off
   * as that block's async load resolves. UI uses these to render skeletons
   * without blocking the whole app on a single Promise.all.
   */
  readonly sessionLoading: Readonly<Record<TaskId, SessionLoadingFlags>>;
}

export interface SessionLoadingFlags {
  readonly agents: boolean;
  readonly transcript: boolean;
  readonly telemetry: boolean;
  readonly slots: boolean;
  readonly plans: boolean;
  readonly summary: boolean;
}

const EMPTY_LOADING: SessionLoadingFlags = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

const ALL_LOADING: SessionLoadingFlags = {
  agents: true,
  transcript: true,
  telemetry: true,
  slots: true,
  plans: true,
  summary: true,
};

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
}

export interface ProviderSpendEntry {
  readonly provider: ProviderTelemetrySummary['provider'];
  readonly spentUsd: number;
  readonly capUsd: number | null;
  readonly pct: number;
}

export interface AppActions {
  hydrate(): Promise<void>;
  setCurrentWorkspace(id: WorkspaceId | null): Promise<void>;
  setCurrentSession(id: TaskId | null): Promise<void>;
  refreshSessions(workspaceId: WorkspaceId): Promise<void>;
  refreshSessionSummary(taskId: TaskId): Promise<void>;
  loadSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string): Promise<void>;
  refreshProviderStatus(status: ProviderStatus): void;
  refreshProviders(): Promise<void>;
  addWorkspace(input: { rootPath: string; name?: string }): Promise<Workspace>;
  deleteWorkspace(id: WorkspaceId): Promise<void>;
  createSession(input: {
    workspaceId: WorkspaceId;
    goal: string;
    branchPrefix?: string;
    branchSlug?: string;
    existingBranch?: string;
    providerPreference?: TaskProviderPreference;
    workflowId?: WorkflowId;
    autoRun?: boolean;
  }): Promise<{ session: Task; worktree: CreatedWorktree }>;
  changeSessionBranch(
    taskId: TaskId,
    args: { branch: string; createNew: boolean },
  ): Promise<void>;
  setSessionAutoRun(taskId: TaskId, autoRun: boolean): Promise<void>;
  maybeAutoAdvanceWorkflow(taskId: TaskId): Promise<void>;
  loadTranscript(agentId: SessionId, taskId: TaskId): Promise<void>;
  appendTurnEvent(agentId: SessionId, taskId: TaskId, event: TurnEvent): void;
  resetTranscript(agentId: SessionId): void;
  sendTurn(input: {
    taskId: TaskId;
    content: string;
    override?: TurnProviderOverride;
    onNewAlerts?: (alerts: ReadonlyArray<BudgetAlert>) => void;
  }): Promise<void>;
  cancelCurrentTurn(taskId: TaskId): Promise<void>;
  endSession(taskId: TaskId): Promise<void>;
  refreshWorkspaceSummary(workspaceId: WorkspaceId): Promise<void>;
  loadSessionTelemetry(taskId: TaskId): Promise<void>;
  loadSessionSlots(taskId: TaskId): Promise<void>;
  upsertSessionSlot(taskId: TaskId, key: SlotKey, value: string): Promise<void>;
  loadSlotHistory(taskId: TaskId, key: SlotKey): Promise<void>;
  toggleSessionSlot(taskId: TaskId, key: SlotKey, enabled: boolean): Promise<void>;
  loadBudgetRules(): Promise<void>;
  saveBudgetRule(rule: Omit<BudgetRule, 'id' | 'createdAt'>): Promise<void>;
  deleteBudgetRule(id: string): Promise<void>;
  loadSessionBudget(taskId: TaskId): Promise<void>;
  setSessionBudget(taskId: TaskId, softCapUsd: number): Promise<void>;
  refreshProviderSpendBreakdown(workspaceId: WorkspaceId): Promise<void>;
  loadBudgetAlerts(): Promise<void>;
  dismissBudgetAlert(id: string): Promise<void>;
  loadSkills(workspaceId: WorkspaceId): Promise<void>;
  saveSkill(input: SkillUpsertArgs): Promise<void>;
  deleteSkill(skillId: SkillId, workspaceId: WorkspaceId): Promise<void>;
  rescanSkills(workspaceId: WorkspaceId): Promise<void>;
  loadPhaseTemplates(workspaceId: WorkspaceId): Promise<void>;
  savePhaseTemplate(template: PhaseTemplateUpsertArgs): Promise<void>;
  deleteWorkflow(id: WorkflowId, workspaceId: WorkspaceId): Promise<void>;
  loadPhaseRunsForSession(taskId: TaskId): Promise<void>;
  selectAgent(taskId: TaskId, agentId: SessionId): Promise<void>;
  spawnAgent(
    taskId: TaskId,
    args: {
      stepId?: StepId;
      name?: string;
      model?: string;
      effort?: string;
      initialPrompt?: string;
    },
  ): Promise<SessionId>;
  renameAgent(taskId: TaskId, agentId: SessionId, name: string): Promise<void>;
  setAgentKind(agentId: SessionId, kind: AgentKind): void;
  setAgentDraft(agentId: SessionId, value: string): void;
  clearAgentDraft(agentId: SessionId): void;
  deleteAgent(taskId: TaskId, agentId: SessionId): Promise<void>;
  wipeLocalDatabase(): Promise<void>;
  dismissSystemAlert(id: string): void;
  setSessionMergeConflicts(taskId: TaskId, conflicts: ReadonlyArray<FileConflict>): void;
  resolveMergeConflicts(
    taskId: TaskId,
    picks: Record<string, string>,
    runStatuses: ReadonlyArray<{ runId: string; completedAt: string; status: string }>,
  ): Promise<void>;
  loadWorkspaceOverrides(workspaceId: WorkspaceId): Promise<void>;
  setWorkspaceOverrides(workspaceId: WorkspaceId, overrides: OverrideSettings): Promise<void>;
  loadSessionOverrides(taskId: TaskId): Promise<void>;
  setTaskOverrides(taskId: TaskId, overrides: OverrideSettings): Promise<void>;
  renameTask(taskId: TaskId, goal: string): Promise<void>;
  autoTitleSession(taskId: TaskId, title: string): Promise<void>;
  bulkDeleteSessionsForWorkspace(
    workspaceId: WorkspaceId,
    taskIds: ReadonlyArray<TaskId>,
  ): Promise<void>;
  deleteTask(taskId: TaskId): Promise<void>;
  setSidebarWorkspaceSearch(query: string): void;
  setSidebarSessionSearch(query: string): void;
  setSidebarStateFilter(states: ReadonlyArray<TurnState['kind']>): void;
  setSidebarProviderFilter(providers: ReadonlyArray<ProviderId>): void;
  exportConfig(): Promise<string | null>;
  importConfig(): Promise<import('@kay-am/types').ConfigBundleImportResult | null>;
  refreshGithubStatus(): Promise<void>;
  setGithubPat(token: string): Promise<GhTokenStatus>;
  clearGithubToken(): Promise<void>;
  refreshSessionPr(taskId: TaskId, opts?: { force?: boolean }): Promise<void>;
  refreshSessionPrDetail(taskId: TaskId, opts?: { force?: boolean }): Promise<void>;
  createPrForSession(taskId: TaskId): Promise<void>;
  clearSessionNextActions(taskId: TaskId): void;
  resolvePermissionRequest(input: {
    taskId: TaskId;
    agentId: SessionId;
    toolUseId: string;
    toolName: string;
    runId: ProviderRunId;
    scope: 'global' | 'workspace' | 'task' | 'once' | 'deny';
  }): Promise<void>;
  setSessionPermissionMode(taskId: TaskId, mode: ClaudePermissionMode): Promise<void>;
  loadDiffComments(taskId: TaskId): Promise<void>;
  addDiffComment(
    taskId: TaskId,
    filePath: string,
    body: string,
    anchor?: import('@kay-am/types').DiffCommentAnchor,
  ): Promise<void>;
  resolveDiffComment(taskId: TaskId, commentId: string): Promise<void>;
  deleteDiffComment(taskId: TaskId, commentId: string): Promise<void>;
  loadNotifications(): Promise<void>;
  emitNotification(
    kind: NotificationKind,
    severity: NotificationSeverity,
    title: string,
    body?: string,
    opts?: { sessionId?: TaskId; workspaceId?: WorkspaceId },
  ): Promise<void>;
  markNotificationsRead(): Promise<void>;
  clearNotifications(): Promise<void>;
  loadSessionPlans(taskId: TaskId): Promise<void>;
  setPlanStatus(taskId: TaskId, planId: PlanId, status: PlanStatus): Promise<void>;
  updatePlanBody(taskId: TaskId, planId: PlanId, title: string, bodyMd: string): Promise<void>;
  deletePlan(taskId: TaskId, planId: PlanId): Promise<void>;
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  workspaces: [],
  currentWorkspaceId: null,
  sessions: [],
  currentSessionId: null,
  settings: {},
  sessionSummary: null,
  providerStatus: null,
  cursorStatus: null,
  codexStatus: null,
  authResults: null,
  providers: buildProviderList({ anthropic: null, cursor: null, codex: null }),
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
  phaseTemplates: {},
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
  sidebarStateFilter: [],
  sidebarProviderFilter: [],
  githubStatus: null,
  sessionGithub: {},
  volatilePermissionAllows: new Set<string>(),
  agentModelOverride: {},
  agentKindOverride: {},
  agentDraft: {},
  diffComments: {},
  notifications: [],
  sessionPlans: {},
  sessionLoading: {},
};

function buildProviderSpendBreakdown(
  providerSummaries: ReadonlyArray<ProviderTelemetrySummary>,
  budgetRules: ReadonlyArray<BudgetRule>,
): ReadonlyArray<ProviderSpendEntry> {
  return providerSummaries.map((s) => {
    const rule = budgetRules.find((r) => r.provider === s.provider) ?? null;
    const capUsd = rule?.capUsd ?? null;
    const pct = capUsd !== null && capUsd > 0 ? s.estimatedCostUsd / capUsd : 0;
    return { provider: s.provider, spentUsd: s.estimatedCostUsd, capUsd, pct };
  });
}

function mergeSlots(
  existing: ReadonlyArray<ContextSlot>,
  next: ContextSlot,
): ReadonlyArray<ContextSlot> {
  const idx = existing.findIndex((s) => s.key === next.key);
  if (idx === -1) return [...existing, next];
  const copy = existing.slice();
  copy[idx] = next;
  return copy;
}

type SetFn = (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void;

// Summarizer queue — one per task, max one in-flight + one queued (coalesced).
// Prevents stacking when the user iterates faster than the summarizer completes.
interface SummarizerQueueEntry {
  readonly turnInput: string;
  readonly turnOutput: string;
}

interface SummarizerTaskQueue {
  inFlight: boolean;
  queued: SummarizerQueueEntry | null;
}

export const summarizerQueues = new Map<TaskId, SummarizerTaskQueue>();

function scheduleIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => fn());
  } else {
    queueMicrotask(fn);
  }
}

function enqueueSummarizer(
  set: SetFn,
  get: () => AppStore,
  taskId: TaskId,
  turnInput: string,
  turnOutput: string,
): void {
  let queue = summarizerQueues.get(taskId);
  if (!queue) {
    queue = { inFlight: false, queued: null };
    summarizerQueues.set(taskId, queue);
  }

  if (queue.inFlight) {
    // Coalesce: overwrite any previously queued entry with the latest.
    queue.queued = { turnInput, turnOutput };
    return;
  }

  queue.inFlight = true;
  queue.queued = null;

  const run = (): void => {
    void runSummarizer(set, get, taskId, turnInput, turnOutput).finally(() => {
      const q = summarizerQueues.get(taskId);
      if (!q) return;
      const next = q.queued;
      if (next) {
        q.queued = null;
        scheduleIdle(() => {
          void runSummarizer(set, get, taskId, next.turnInput, next.turnOutput).finally(() => {
            const q2 = summarizerQueues.get(taskId);
            if (q2) {
              q2.inFlight = false;
            }
          });
        });
      } else {
        q.inFlight = false;
      }
    });
  };

  scheduleIdle(run);
}

function applySessionUpdate(
  set: SetFn,
  taskId: TaskId,
  state: TurnState,
  agentId?: SessionId,
): void {
  set((store) => ({
    sessions: store.sessions.map((s) =>
      s.id === taskId ? { ...s, state, updatedAt: new Date().toISOString() as IsoDateTime } : s,
    ),
    ...(agentId !== undefined && {
      agentTurnState: { ...store.agentTurnState, [agentId]: state },
    }),
  }));
}

async function runSummarizer(
  set: SetFn,
  get: () => AppStore,
  taskId: TaskId,
  turnInput: string,
  turnOutput: string,
): Promise<void> {
  const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

  // Mark running without a separate set — merged into the final batch below on success,
  // or emitted immediately only on the error path. This avoids a spurious re-render at start.
  set((state) => {
    const prev = state.summarizerStatus[taskId];
    return {
      summarizerStatus: {
        ...state.summarizerStatus,
        [taskId]: {
          status: 'running',
          lastUpdate: prev?.lastUpdate ?? null,
          error: null,
          lastUsage: prev?.lastUsage ?? null,
        },
      },
    };
  });

  try {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) return;

    const providerId = session.providerPreference.defaultProvider;
    const summarizer = new Summarizer({ providerId, invokeFn: invoke });
    const prevSlots = get().sessionSlots[taskId] ?? [];
    const ghPr = get().sessionGithub[taskId]?.pr ?? null;
    const prState = ghPr
      ? {
          hasOpenPr: ghPr.state === 'open' || ghPr.state === 'draft' || ghPr.state === 'approved',
          checksGreen: ghPr.checks === 'success',
        }
      : null;
    const result = await summarizer.summarize({ prevSlots, turnInput, turnOutput, prState });

    // Parallel slot history + upsert writes — no serial await per slot.
    await Promise.all(
      result.delta.upserts.map(async (upsert) => {
        const existing = (get().sessionSlots[taskId] ?? []).find((s) => s.key === upsert.key);
        if (existing && existing.value !== upsert.value) {
          await insertContextSlotHistory(
            tauriDatabase,
            taskId,
            crypto.randomUUID(),
            upsert.key,
            existing.value,
            'summarizer',
          );
        }
        const next: ContextSlot = {
          key: upsert.key,
          value: upsert.value,
          enabled: existing?.enabled ?? true,
        };
        await upsertContextSlot(tauriDatabase, taskId, next);
      }),
    );

    const summarizerRunId = crypto.randomUUID() as ProviderRunId;
    const startedAt = now();

    // Parallel: telemetry write + slot refresh + analytics queries.
    const [
      refreshed,
      ,
      sessionSummary,
      workspaceSummary,
      telemetry,
      providerSummaries,
      budgetRules,
    ] = await Promise.all([
      listContextSlotsForTask(tauriDatabase, taskId),
      insertProviderRun(tauriDatabase, {
        id: summarizerRunId,
        taskId,
        provider: providerId,
        model: result.model,
        status: { kind: 'streaming', startedAt },
        createdAt: startedAt,
      })
        .then(() =>
          updateProviderRunStatus(tauriDatabase, summarizerRunId, {
            kind: 'succeeded',
            finishedAt: now(),
          }),
        )
        .then(() => {
          const record: TelemetryRecord = {
            id: crypto.randomUUID() as TelemetryRecordId,
            runId: summarizerRunId,
            taskId,
            kind: 'summarizer',
            provider: providerId,
            model: result.model,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            estimatedCostUsd: result.usage.estimatedCostUsd,
            recordedAt: now(),
          };
          return insertTelemetry(tauriDatabase, record);
        }),
      summarizeTaskTelemetry(tauriDatabase, taskId),
      summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
      listTelemetryForTask(tauriDatabase, taskId),
      summarizeWorkspaceProviderTelemetry(tauriDatabase, session.workspaceId),
      invokeBudgetRuleList(),
    ]);

    // Single batched set — one re-render for the entire summarizer completion.
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [taskId]: refreshed },
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: { ...state.sessionTelemetry, [taskId]: telemetry },
      summarizerStatus: {
        ...state.summarizerStatus,
        [taskId]: {
          status: 'idle',
          lastUpdate: now(),
          error: null,
          lastUsage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            estimatedCostUsd: result.usage.estimatedCostUsd,
          },
        },
      },
      sessionNextActions: { ...state.sessionNextActions, [taskId]: result.nextActions },
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    }));
    void get().emitNotification('summarizer-success', 'info', 'context summarized', undefined, {
      sessionId: taskId,
    });
  } catch (err) {
    // never log api key — only the error message
    const message = formatError(err);
    if (import.meta.env.DEV) {
      console.warn(`[summarizer] failed for session ${taskId}: ${message}`);
    }
    set((state) => {
      const prev = state.summarizerStatus[taskId];
      return {
        summarizerStatus: {
          ...state.summarizerStatus,
          [taskId]: {
            status: 'error',
            lastUpdate: now(),
            error: message,
            lastUsage: prev?.lastUsage ?? null,
          },
        },
      };
    });
    void get().emitNotification('error', 'error', 'summarizer failed', message, {
      sessionId: taskId,
    });
  }
}

async function buildPlanKickoffSection(taskId: TaskId): Promise<string> {
  try {
    const plans = await invokeListPlansForSession(taskId);
    const plan = plans[0];
    if (!plan) return '';
    if (plan.status === 'completed') {
      return [
        'The most recent plan in this session was completed and should NOT be re-executed. Provided for context only:',
        '',
        plan.bodyMd,
      ].join('\n');
    }
    if (plan.status === 'superseded') return '';
    return ['Active plan to execute:', '', plan.bodyMd].join('\n');
  } catch {
    return '';
  }
}

function composeKickoff(planSection: string, baseKickoff: string): string {
  if (planSection.length === 0) return baseKickoff;
  if (baseKickoff.length === 0) return planSection;
  return `${planSection}\n\n${baseKickoff}`;
}

async function capturePlanFromTurn(
  set: SetFn,
  taskId: TaskId,
  agentId: SessionId,
  assistantText: string,
): Promise<void> {
  try {
    const extracted = extractPlanFromMarker(assistantText);
    if (!extracted) return;
    await invokeUpsertPlan({
      sessionId: taskId,
      agentId,
      title: extracted.title,
      bodyMd: extracted.bodyMd,
      status: 'active',
    });
    const refreshed = await invokeListPlansForSession(taskId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [taskId]: refreshed },
    }));
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[plan-capture] failed for session ${taskId}: ${formatError(err)}`);
    }
  }
}

interface SummarizeCommandResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

async function generateAutoTitle(
  set: SetFn,
  get: () => AppStore,
  taskId: TaskId,
  turnInput: string,
  turnOutput: string,
  agentId: SessionId | null,
): Promise<void> {
  try {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) return;
    const providerId = session.providerPreference.defaultProvider;
    const systemPrompt =
      'You generate a short title for an AI coding session. Return ONLY the title, 2-4 words, all lowercase, no quotes, no trailing punctuation, no explanation. The title should be a concise micro-summary of what the agent is doing (e.g. "refactor auth module", "debug startup crash", "fix login bug"). It will be used as both the session title and the agent display name.';
    const userMessage = [
      'User request (excerpt):',
      turnInput.slice(0, 600),
      '',
      'Assistant reply (excerpt):',
      turnOutput.slice(0, 300),
      '',
      'Write the title now.',
    ].join('\n');
    const result = await invoke<SummarizeCommandResult>('summarize_task', {
      args: { providerId, userMessage, systemPrompt },
    });
    if ((result.exitCode ?? 0) !== 0) return;
    let title = '';
    if (providerId === 'anthropic') {
      try {
        const parsed = JSON.parse(result.stdout.trim()) as { result?: string };
        title = (parsed.result ?? '').trim();
      } catch {
        title = result.stdout.trim();
      }
    } else {
      title = result.stdout.trim();
    }
    title = title
      .replace(/^["']|["']$/g, '')
      .replace(/[.!?]+$/, '')
      .trim()
      .toLowerCase();
    if (!title) return;
    const titleNow = new Date().toISOString() as IsoDateTime;
    if (!session.titleUserEdited) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === taskId ? { ...s, goal: title } : s)),
      }));
      await renameSessionInDb(tauriDatabase, taskId, title, titleNow, false);
    }
    if (agentId) {
      await get().renameAgent(taskId, agentId, title);
    }
  } catch {
    // auto-title is best-effort
  }
}

const AUDIT_RETRY_MAX_ATTEMPTS = 5;
const AUDIT_RETRY_DRAIN_BATCH = 50;
// Exponential backoff delays (ms): attempt 0→1s, 1→2s, 2→4s, 3→8s, 4→16s.
const AUDIT_RETRY_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000] as const;

function auditRetryBackoffMs(attempt: number): number {
  return AUDIT_RETRY_BACKOFF_MS[Math.min(attempt, AUDIT_RETRY_BACKOFF_MS.length - 1)] ?? 16000;
}

async function drainAuditRetryQueue(set: SetFn): Promise<void> {
  let entries: ReadonlyArray<AuditRetryEntry>;
  try {
    entries = await invokeAuditRetryDrain(AUDIT_RETRY_DRAIN_BATCH);
  } catch {
    return;
  }

  const now = () => new Date().toISOString();

  for (const entry of entries) {
    // Respect backoff: skip entries updated too recently for their attempt count.
    const backoffMs = auditRetryBackoffMs(entry.attempts);
    const msSinceUpdate = Date.now() - entry.updatedAt;
    if (msSinceUpdate < backoffMs) continue;

    let payload: PermissionAuditInsertPayload;
    try {
      payload = JSON.parse(entry.payloadJson) as PermissionAuditInsertPayload;
    } catch {
      await invokeAuditRetryDelete(entry.id).catch(() => undefined);
      set((state) => ({
        systemAlerts: [
          ...state.systemAlerts,
          {
            id: crypto.randomUUID(),
            kind: 'audit-retry-corrupt' as const,
            message: `permission audit retry entry ${entry.id} had corrupt payload and was dropped`,
            createdAt: now(),
          },
        ],
      }));
      continue;
    }

    try {
      await invokePermissionAuditInsert(payload);
      await invokeAuditRetryDelete(entry.id);
    } catch (err) {
      const nextAttempts = entry.attempts + 1;
      const errMsg = formatError(err);

      if (nextAttempts >= AUDIT_RETRY_MAX_ATTEMPTS) {
        await invokeAuditRetryDelete(entry.id).catch(() => undefined);
        set((state) => ({
          systemAlerts: [
            ...state.systemAlerts,
            {
              id: crypto.randomUUID(),
              kind: 'audit-retry-exhausted' as const,
              message: `permission audit retry for entry ${entry.id} exhausted after ${AUDIT_RETRY_MAX_ATTEMPTS} attempts: ${errMsg}`,
              createdAt: now(),
            },
          ],
        }));
      } else {
        await invokeAuditRetryUpdate(entry.id, nextAttempts, errMsg).catch(() => undefined);
      }
    }
  }
}

// Module-scoped guard: React StrictMode mounts the root twice in dev so
// `useEffect(() => void hydrate(), …)` fires twice in rapid succession. Without
// this guard both invocations race on `runDbMigrations()` → UNIQUE constraint
// failed on schema_version.version. Returning the same in-flight promise makes
// the second call wait for the first.
let hydratePromise: Promise<void> | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  hydrate: async () => {
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      try {
        set({ bootPhase: 'migrating', error: null });
        await runDbMigrations();

        set({ bootPhase: 'loading-settings' });
        const [editorBinary, lastWorkspaceRaw, lastSessionRaw] = await Promise.all([
          getSetting(tauriDatabase, SETTING_EDITOR_BINARY),
          getSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID),
          getSetting(tauriDatabase, SETTING_LAST_SESSION_ID),
        ]);
        set((state) => {
          const next = { ...state.settings };
          if (editorBinary !== null) next[SETTING_EDITOR_BINARY] = editorBinary;
          if (lastWorkspaceRaw !== null) next[SETTING_LAST_WORKSPACE_ID] = lastWorkspaceRaw;
          if (lastSessionRaw !== null) next[SETTING_LAST_SESSION_ID] = lastSessionRaw;
          return { settings: next };
        });

        set({ bootPhase: 'detecting-cli' });
        const [providerStatus, cursorStatus, codexStatus, detectedEditors] = await Promise.all([
          getProviderStatus('anthropic'),
          getCursorStatus(),
          getCodexStatus(),
          detectEditors(),
        ]);
        set({ detectedEditors });
        const statuses: ProviderStatuses = {
          anthropic: providerStatus,
          cursor: cursorStatus,
          codex: codexStatus,
        };
        set({
          providerStatus,
          cursorStatus,
          codexStatus,
          providers: buildProviderList(statuses),
        });

        const [anthropicAuth, cursorAuth, codexAuth] = await Promise.all([
          checkProviderAuth('anthropic'),
          checkProviderAuth('cursor'),
          checkProviderAuth('codex'),
        ]);
        const authResults: ProviderAuthResults = {
          anthropic: anthropicAuth,
          cursor: cursorAuth,
          codex: codexAuth,
        };
        set({ authResults, providers: buildProviderList(statuses, authResults) });

        set({ bootPhase: 'loading-workspaces' });
        const workspaces = await listWorkspaces(tauriDatabase);
        set({ workspaces });

        set({ bootPhase: 'restoring-session' });
        const lastWorkspaceId =
          lastWorkspaceRaw && lastWorkspaceRaw.length > 0
            ? (lastWorkspaceRaw as WorkspaceId)
            : null;
        const targetWorkspace = lastWorkspaceId
          ? (workspaces.find((w) => w.id === lastWorkspaceId) ?? null)
          : null;
        if (targetWorkspace) {
          await get().setCurrentWorkspace(targetWorkspace.id);
          const lastSessionId =
            lastSessionRaw && lastSessionRaw.length > 0 ? (lastSessionRaw as TaskId) : null;
          if (lastSessionId) {
            const sessions = get().sessions;
            if (sessions.some((s) => s.id === lastSessionId)) {
              await get().setCurrentSession(lastSessionId);
            }
          }
        }

        set({ bootPhase: 'ready', hydrated: true });

        // Drain audit retry queue after boot — non-blocking, best-effort.
        void drainAuditRetryQueue(set);

        void get().refreshGithubStatus();
      } catch (err) {
        set({
          bootPhase: 'error',
          error: formatError(err),
          hydrated: true,
        });
      }
    })();
    try {
      await hydratePromise;
    } finally {
      // Clear so manual retry from BootSplash can re-run hydrate.
      hydratePromise = null;
    }
  },

  setCurrentWorkspace: async (id) => {
    // Cancel any running turns before clearing state — orphaned Rust child processes
    // keep emitting turn_events into stale sessionIds if we don't stop them first.
    const runningSessions = get().sessions.filter((s) => s.state.kind === 'running');
    await Promise.all(
      runningSessions.map((s) =>
        cancelTurn((s.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(() => {
          // best-effort: Rust TurnRegistry may have already cleaned up
        }),
      ),
    );

    // Option A: wipe all per-session maps unconditionally. Simpler than filtering by
    // workspaceId (Option B) and correct because setCurrentSession reloads from DB
    // on demand — the cache is cheap to rebuild, stale cross-workspace data is not.
    set({
      currentWorkspaceId: id,
      currentSessionId: null,
      sessions: [],
      sessionSummary: null,
      workspaceSummary: null,
      transcripts: {},
      messages: {},
      sessionTelemetry: {},
      sessionSlots: {},
      slotHistory: {},
      sessionWorktrees: {},
      sessionBranches: {},
      sessionPhaseRuns: {},
      selectedAgentId: {},
      agentRunHistory: {},
      agentTurnState: {},
      sessionMergeConflicts: {},
      sessionBudgets: {},
      summarizerStatus: {},
      sessionNextActions: {},
      budgetAlerts: [],
      unknownPayloadCounts: {},
      sidebarSessionSearch: '',
      sidebarStateFilter: [],
      sidebarProviderFilter: [],
      sessionLoading: {},
    });
    if (id) {
      const [
        loadedSessions,
        workspaceSummary,
        providerSummaries,
        budgetRules,
        skills,
        phaseTemplates,
      ] = await Promise.all([
        listTasksForWorkspace(tauriDatabase, id),
        summarizeWorkspaceTelemetry(tauriDatabase, id),
        summarizeWorkspaceProviderTelemetry(tauriDatabase, id),
        invokeBudgetRuleList(),
        invokeSkillList(id),
        invokePhaseTemplateList(id),
      ]);
      // Boot-recovery: a session row in 'running' state is necessarily orphaned
      // here — the Rust TurnRegistry is reset on every app start, so there is
      // no live process to reattach to. Normalize to 'idle' so the UI re-enables
      // the input. Persist the correction back to the DB.
      const recoveryNow = new Date().toISOString() as IsoDateTime;
      const sessions = await Promise.all(
        loadedSessions.map(async (s) => {
          if (s.state.kind !== 'running') return s;
          const idleState: TurnState = { kind: 'idle', lastActivityAt: recoveryNow };
          await updateTaskState(tauriDatabase, s.id, idleState, recoveryNow).catch(() => undefined);
          return { ...s, state: idleState, updatedAt: recoveryNow };
        }),
      );
      const worktreeRows = await Promise.all(
        sessions.map((s) => listWorktreesForTask(tauriDatabase, s.id)),
      );
      const sessionWorktrees: Record<string, ReadonlyArray<string>> = {};
      const sessionBranches: Record<string, string> = {};
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i]!;
        const rows = worktreeRows[i]!;
        if (rows.length > 0) {
          sessionWorktrees[s.id] = rows.map((r) => r.worktreePath);
          const primaryRow = rows[0];
          if (primaryRow) sessionBranches[s.id] = primaryRow.branch;
        }
      }
      set((state) => ({
        sessions,
        sessionWorktrees,
        sessionBranches,
        workspaceSummary,
        providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
        skills: { ...state.skills, [id]: skills },
        phaseTemplates: { ...state.phaseTemplates, [id]: phaseTemplates },
      }));
    } else {
      set({ providerSpendBreakdown: [] });
    }
    await dbSetSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID, id ?? '');
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
  },

  setCurrentSession: async (id) => {
    // No-op when the click lands on the already-current session. Pulled into
    // the action so callers can pass the action ref directly (stable ref
    // helps memoized rows skip re-renders on session-switch clicks).
    if (get().currentSessionId === id) return;
    // Immediately swap the visible session so the UI doesn't freeze while
    // heavy per-session data loads. Each block (agents/transcript/telemetry/
    // slots/plans/summary) loads independently and flips its own loading flag
    // off when done — see SessionLoadingFlags. We intentionally do NOT await
    // these loaders here; the chat view and context panel render skeletons in
    // the meantime.
    const tSwitch = performance.now();
    // Cache check up-front: any slice already loaded for this task skips its
    // refetch. With the LRU keep-alive five sessions stay hot in the store,
    // so revisiting them is a near-zero-cost flag flip instead of 5 round
    // trips through Tauri IPC. Mutations refresh slices directly, so the
    // in-memory cache stays consistent until a process outside the app
    // touches the SQLite file.
    const stateNow = get();
    const cached = id
      ? {
          telemetry: stateNow.sessionTelemetry[id] !== undefined,
          slots: stateNow.sessionSlots[id] !== undefined,
          plans: stateNow.sessionPlans[id] !== undefined,
          agents: stateNow.sessionPhaseRuns[id] !== undefined,
        }
      : null;
    // Transcript flag is tricky on revisit: if agents are cached but the
    // session has no agents we never get a selectAgent call to clear it; if
    // the selected agent's transcript is already cached we shouldn't show a
    // skeleton at all.
    const cachedSelectedAgentId =
      id && cached?.agents ? (stateNow.selectedAgentId[id] ?? null) : null;
    const transcriptReady =
      id && cached?.agents
        ? cachedSelectedAgentId === null
          ? true // empty session
          : stateNow.transcripts[cachedSelectedAgentId] !== undefined
        : false;
    const initialLoading: SessionLoadingFlags = id
      ? {
          agents: cached ? !cached.agents : true,
          transcript: !transcriptReady,
          telemetry: cached ? !cached.telemetry : true,
          slots: cached ? !cached.slots : true,
          plans: cached ? !cached.plans : true,
          summary: true,
        }
      : EMPTY_LOADING;
    set((state) => ({
      currentSessionId: id,
      sessionSummary: null,
      sessionLoading: id ? { ...state.sessionLoading, [id]: initialLoading } : state.sessionLoading,
    }));
    // Fire-and-forget the persisted setting. Awaiting it here delayed every
    // downstream parallel fetch by the IPC round-trip (~5-50ms of dead time).
    void dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, id ?? '');
    if (!id) return;
    const perf = (op: string) => {
      const t0 = performance.now();
      return () => {
        // eslint-disable-next-line no-console
        console.log(`[perf] session:${op} ${(performance.now() - t0).toFixed(0)}ms`);
      };
    };
    // eslint-disable-next-line no-console
    console.log(`[perf] session:switchSync ${(performance.now() - tSwitch).toFixed(0)}ms`);

    const markDone = (key: keyof SessionLoadingFlags): void => {
      set((state) => {
        if (state.currentSessionId !== id) return {};
        const current = state.sessionLoading[id] ?? EMPTY_LOADING;
        return {
          sessionLoading: { ...state.sessionLoading, [id]: { ...current, [key]: false } },
        };
      });
    };

    // Summary
    const endSummary = perf('summary');
    void summarizeTaskTelemetry(tauriDatabase, id)
      .then((summary) => {
        set((state) => (state.currentSessionId === id ? { sessionSummary: summary } : {}));
      })
      .catch(() => {})
      .finally(() => {
        endSummary();
        markDone('summary');
      });

    // Telemetry
    if (!cached?.telemetry) {
      const endTelemetry = perf('telemetry');
      void listTelemetryForTask(tauriDatabase, id)
        .then((telemetry) => {
          set((state) => ({
            sessionTelemetry: { ...state.sessionTelemetry, [id]: telemetry },
          }));
        })
        .catch(() => {})
        .finally(() => {
          endTelemetry();
          markDone('telemetry');
        });
    }

    // Context slots
    if (!cached?.slots) {
      const endSlots = perf('slots');
      void listContextSlotsForTask(tauriDatabase, id)
        .then((slots) => {
          set((state) => ({
            sessionSlots: { ...state.sessionSlots, [id]: slots },
          }));
        })
        .catch(() => {})
        .finally(() => {
          endSlots();
          markDone('slots');
        });
    }

    // Plans
    if (!cached?.plans) {
      const endPlans = perf('plans');
      void (async (): Promise<ReadonlyArray<Plan>> => {
        try {
          return await invokeListPlansForSession(id);
        } catch {
          return [];
        }
      })()
        .then((plans) => {
          set((state) => ({
            sessionPlans: { ...state.sessionPlans, [id]: plans },
          }));
        })
        .catch(() => {})
        .finally(() => {
          endPlans();
          markDone('plans');
        });
    }

    // Agents only: transcript is loaded lazily by ChatView when an agent is
    // selected (via selectAgent). Keeps session switch fast — no per-agent
    // history fetch blocks the UI.
    if (cached?.agents) {
      // Cached: phase runs + selected agent are already in store. transcript
      // flag still gets cleared by ChatView's selectAgent effect (cached or
      // fresh). Nothing else to do.
    } else {
    const endAgents = perf('agents+runIds');
    const endPhaseRunList = perf('agents:phaseRunList');
    const endRunIds = perf('agents:runIds');
    void Promise.all([
      invokePhaseRunList(id).finally(() => endPhaseRunList()),
      listAgentRunIdsForTask(tauriDatabase, id).finally(() => endRunIds()),
    ])
      .then(([agents, agentRunIds]) => {
        const previouslySelected = get().selectedAgentId[id] ?? null;
        const sortedAgents = [...agents].sort((a, b) => a.ordinal - b.ordinal);
        const fallbackAgent = sortedAgents[0] ?? null;
        const selectedAgent =
          (previouslySelected && agents.find((a) => a.id === previouslySelected)) || fallbackAgent;

        // Seed agentRunHistory with EVERY provider run an agent ever spawned,
        // not just its latest. Recovered from turn_events (single source of
        // truth post restart) so aggregate token/cost counters in the sidebar
        // reflect the full agent lifetime — birth to death — instead of the
        // last turn.
        const seededHistory: Record<string, ReadonlyArray<ProviderRunId>> = {};
        const seededTurnState: Record<string, TurnState> = {};
        const task = get().sessions.find((s) => s.id === id);
        const taskState =
          task?.state ?? ({ kind: 'idle', lastActivityAt: new Date().toISOString() } as TurnState);
        for (const agent of agents) {
          const historical = agentRunIds.get(agent.id) ?? [];
          const merged: ProviderRunId[] = [...historical];
          if (agent.runId && !merged.includes(agent.runId)) merged.push(agent.runId);
          if (merged.length > 0) {
            seededHistory[agent.id] = merged;
          }
          if (agent.status === 'running' && agent.runId) {
            seededTurnState[agent.id] = {
              kind: 'running',
              runId: agent.runId,
              startedAt: agent.startedAt ?? (new Date().toISOString() as IsoDateTime),
            };
          } else if (agent.status === 'failed') {
            seededTurnState[agent.id] = {
              kind: 'error',
              message: 'agent failed',
              failedAt: agent.completedAt ?? (new Date().toISOString() as IsoDateTime),
            };
          } else {
            seededTurnState[agent.id] =
              taskState.kind === 'ended'
                ? taskState
                : { kind: 'idle', lastActivityAt: new Date().toISOString() as IsoDateTime };
          }
        }

        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [id]: agents },
          selectedAgentId: {
            ...state.selectedAgentId,
            [id]: selectedAgent?.id ?? null,
          },
          agentRunHistory: { ...state.agentRunHistory, ...seededHistory },
          agentTurnState: { ...state.agentTurnState, ...seededTurnState },
        }));
        markDone('agents');

        // No selected agent → no chat to render → drop transcript flag now.
        // With a selected agent, ChatView's effect calls selectAgent which
        // owns the flag lifecycle from there.
        if (!selectedAgent) {
          set((state) => ({
            messages: { ...state.messages, [id]: [] as ReadonlyArray<Message> },
          }));
          markDone('transcript');
        }
      })
      .catch(() => {
        markDone('agents');
        markDone('transcript');
      })
      .finally(() => endAgents());
    }
  },

  refreshSessions: async (workspaceId) => {
    const sessions = await listTasksForWorkspace(tauriDatabase, workspaceId);
    set({ sessions });
  },

  refreshSessionSummary: async (taskId) => {
    const summary = await summarizeTaskTelemetry(tauriDatabase, taskId);
    set({ sessionSummary: summary });
  },

  loadSetting: async (key) => {
    const value = await getSetting(tauriDatabase, key);
    set((state) => ({
      settings: value === null ? state.settings : { ...state.settings, [key]: value },
    }));
    return value;
  },

  saveSetting: async (key, value) => {
    await dbSetSetting(tauriDatabase, key, value);
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
  },

  refreshProviderStatus: (status) => {
    set((state) => {
      const statuses: ProviderStatuses = {
        anthropic: status,
        cursor: state.cursorStatus,
        codex: state.codexStatus,
      };
      return {
        providerStatus: status,
        providers: buildProviderList(statuses, state.authResults ?? undefined),
      };
    });
  },

  refreshProviders: async () => {
    const [providerStatus, cursorStatus, codexStatus] = await Promise.all([
      getProviderStatus('anthropic'),
      getCursorStatus(),
      getCodexStatus(),
    ]);
    const statuses: ProviderStatuses = {
      anthropic: providerStatus,
      cursor: cursorStatus,
      codex: codexStatus,
    };
    const [anthropicAuth, cursorAuth, codexAuth] = await Promise.all([
      checkProviderAuth('anthropic'),
      checkProviderAuth('cursor'),
      checkProviderAuth('codex'),
    ]);
    const authResults: ProviderAuthResults = {
      anthropic: anthropicAuth,
      cursor: cursorAuth,
      codex: codexAuth,
    };
    set({
      providerStatus,
      cursorStatus,
      codexStatus,
      authResults,
      providers: buildProviderList(statuses, authResults),
    });
  },

  createSession: async ({
    workspaceId,
    goal,
    branchPrefix,
    branchSlug,
    existingBranch,
    providerPreference,
    workflowId,
    autoRun,
  }) => {
    const workspace = (await listWorkspaces(tauriDatabase)).find((w) => w.id === workspaceId);
    if (!workspace) throw new Error(`workspace not found: ${workspaceId}`);

    const prefix = branchPrefix?.trim() || 'kay';
    const slugSeed =
      branchSlug?.trim() || (goal.trim().length > 0 ? goal : `session-${Date.now()}`);
    const trimmedExisting = existingBranch?.trim();
    const worktree = await createWorktree({
      repoPath: workspace.rootPath,
      branchPrefix: prefix,
      slug: slugSeed,
      ...(trimmedExisting ? { existingBranch: trimmedExisting } : {}),
    });

    const now = new Date().toISOString() as IsoDateTime;
    const initialState: TurnState = { kind: 'draft' };
    const session: Task = {
      id: crypto.randomUUID() as TaskId,
      workspaceId,
      goal: goal.trim() || worktree.slug,
      state: initialState,
      contextSlots: [],
      providerPreference: providerPreference ?? DEFAULT_TASK_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      ...(workflowId !== undefined ? { workflowId } : {}),
      autoRun: autoRun === true && workflowId !== undefined,
      titleUserEdited: false,
      createdAt: now,
      updatedAt: now,
    };
    await insertTask(tauriDatabase, session);
    await insertTaskWorktree(tauriDatabase, {
      id: crypto.randomUUID(),
      taskId: session.id,
      worktreePath: worktree.worktreePath,
      branch: worktree.branchName,
      parallelIndex: 0,
      createdAt: Date.now(),
    });

    // Seed the goal context slot so the session prompt carries the user's
    // stated goal from turn 1. Otherwise the goal lives only on the session
    // row and never reaches the model unless the user retypes it in the
    // context panel.
    const goalText = session.goal.trim();
    if (goalText.length > 0) {
      await upsertContextSlot(tauriDatabase, session.id, {
        key: 'goal',
        value: goalText,
        enabled: true,
      });
    }

    // Every session spawns exactly one agent up-front. Without a workflow
    // attached this is a generic "agent 1" so the chat view has something to
    // render. With a workflow attached this is the FIRST step's agent only —
    // subsequent phases are user-driven via the lit "start <next>" CTA in the
    // agents bar (issue #424). Spawning all phases up-front buried the
    // current step in a list and removed any sense of progression.
    let firstAgent: Session;
    let firstStepPromptPrefix = '';
    let firstAgentModel: string | null = null;
    if (workflowId) {
      const templates = get().phaseTemplates[workspaceId] ?? [];
      const template = templates.find((t) => t.id === workflowId) ?? null;
      const firstStep = template
        ? [...template.steps].sort((a, b) => a.ordinal - b.ordinal)[0]
        : null;
      if (template && firstStep) {
        firstStepPromptPrefix = firstStep.promptPrefix;
        const kind = inferAgentKindFromName(firstStep.name);
        firstAgentModel = AGENT_KIND_DEFAULTS[kind].model;
        firstAgent = await invokePhaseRunInsert({
          taskId: session.id,
          stepId: firstStep.id,
          ordinal: 0,
          name: firstStep.name,
          status: 'pending',
        });
      } else {
        firstAgent = await invokePhaseRunInsert({
          taskId: session.id,
          ordinal: 0,
          name: 'agent 1',
          status: 'pending',
        });
      }
    } else {
      firstAgent = await invokePhaseRunInsert({
        taskId: session.id,
        ordinal: 0,
        name: 'agent 1',
        status: 'pending',
      });
    }
    const prespawnedRuns: ReadonlyArray<Session> = [firstAgent];

    set((state) => ({
      sessions:
        state.currentWorkspaceId === workspaceId ? [session, ...state.sessions] : state.sessions,
      currentSessionId: session.id,
      sessionSummary: null,
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [session.id]: [worktree.worktreePath],
      },
      sessionBranches: {
        ...state.sessionBranches,
        [session.id]: worktree.branchName,
      },
      sessionSlots: {
        ...state.sessionSlots,
        [session.id]: goalText.length > 0 ? [{ key: 'goal', value: goalText, enabled: true }] : [],
      },
      sessionPhaseRuns: { ...state.sessionPhaseRuns, [session.id]: prespawnedRuns },
      selectedAgentId: { ...state.selectedAgentId, [session.id]: firstAgent.id },
      transcripts: { ...state.transcripts, [firstAgent.id]: [] },
      messages: { ...state.messages, [session.id]: [] },
      agentTurnState: { ...state.agentTurnState, [firstAgent.id]: { kind: 'draft' } },
      ...(firstAgentModel !== null && {
        agentModelOverride: { ...get().agentModelOverride, [firstAgent.id]: firstAgentModel },
      }),
    }));
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, session.id);

    if (firstStepPromptPrefix.length > 0) {
      void get().sendTurn({ taskId: session.id, content: firstStepPromptPrefix });
    }

    void get().emitNotification(
      'session-created',
      'success',
      `session created: ${session.goal}`,
      undefined,
      { sessionId: session.id, workspaceId: session.workspaceId },
    );

    return { session, worktree };
  },

  changeSessionBranch: async (taskId, { branch, createNew }) => {
    const target = branch.trim();
    if (!target) throw new Error('branch name cannot be empty');
    const worktrees = await listWorktreesForTask(tauriDatabase, taskId);
    const primary = worktrees[0];
    if (!primary) throw new Error(`no worktree found for session ${taskId}`);
    const task = get().sessions.find((s) => s.id === taskId);
    const workspace = task
      ? get().workspaces.find((w) => w.id === task.workspaceId)
      : null;
    if (!workspace) throw new Error('workspace not found for session');
    await changeWorktreeBranch({
      repoPath: workspace.rootPath,
      worktreePath: primary.worktreePath,
      branch: target,
      createNew,
    });
    await updateTaskWorktreeBranch(tauriDatabase, taskId, primary.parallelIndex, target);
    set((state) => ({
      sessionBranches: { ...state.sessionBranches, [taskId]: target },
    }));
  },

  loadTranscript: async (agentId, taskId) => {
    const [messages, events] = await Promise.all([
      listMessagesForAgent(tauriDatabase, agentId),
      listTurnEventsForAgent(tauriDatabase, agentId),
    ]);
    set((state) => ({
      messages: { ...state.messages, [taskId]: messages },
      transcripts: { ...state.transcripts, [agentId]: events },
    }));
  },

  appendTurnEvent: (agentId, taskId, event) => {
    set((state) => {
      const existing = state.transcripts[agentId] ?? [];
      const updatedTranscripts = { ...state.transcripts, [agentId]: [...existing, event] };
      if (event.kind === 'unknown_payload') {
        const key = `${event.adapter}:${event.payloadType}`;
        return {
          transcripts: updatedTranscripts,
          unknownPayloadCounts: {
            ...state.unknownPayloadCounts,
            [key]: (state.unknownPayloadCounts[key] ?? 0) + 1,
          },
        };
      }
      // M1: capture claude's session id from the `system` init event so the
      // next turn for this agent can pass `--resume <id>`. Update in-memory
      // sessionPhaseRuns + persist; tolerate transient DB failures (worst
      // case: next turn starts fresh, no data loss).
      if (event.kind === 'provider_session_init') {
        const runs = state.sessionPhaseRuns[taskId] ?? [];
        const updatedRuns = runs.map((s) =>
          s.id === agentId ? { ...s, providerSessionId: event.providerSessionId } : s,
        );
        void insertTurnEvent(tauriDatabase, {
          id: crypto.randomUUID(),
          taskId,
          agentId,
          event,
        }).catch(() => undefined);
        void invokeSessionSetProviderSessionId(agentId, event.providerSessionId).catch((err) => {
          if (import.meta.env.DEV) {
            const message = formatError(err);
            console.warn(`[turn-events] persist provider_session_id failed: ${message}`);
          }
        });
        return {
          transcripts: updatedTranscripts,
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: updatedRuns },
        };
      }
      return { transcripts: updatedTranscripts };
    });
    if (event.kind === 'provider_session_init') return;
    void insertTurnEvent(tauriDatabase, {
      id: crypto.randomUUID(),
      taskId,
      agentId,
      event,
    }).catch((err) => {
      if (import.meta.env.DEV) {
        const message = formatError(err);
        console.warn(`[turn-events] insert failed for agent ${agentId}: ${message}`);
      }
    });
  },

  resetTranscript: (agentId) => {
    set((state) => ({
      transcripts: { ...state.transcripts, [agentId]: [] },
    }));
  },

  sendTurn: async ({ taskId, content, override, onNewAlerts }) => {
    const before = get();
    const session = before.sessions.find((s) => s.id === taskId);
    if (!session) throw new Error(`session not found: ${taskId}`);
    const workingDir = (before.sessionWorktrees[taskId] ?? [])[0] ?? null;
    if (!workingDir) {
      throw new Error(
        'session worktree not initialized — restart the app to reload persisted worktree paths',
      );
    }

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

    const activeAgentId = before.selectedAgentId[taskId] ?? null;
    if (!activeAgentId) {
      throw new Error('no agent selected — spawn one before sending a turn');
    }

    const userTurnText = content;
    let resolvedPrompt = content;

    const slashCmd = parseSlashCommand(content);
    if (slashCmd !== null) {
      const workspaceSkills = before.skills[session.workspaceId] ?? [];
      const skill = workspaceSkills.find((s) => s.name === slashCmd.name);
      if (!skill) {
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, taskId, {
          kind: 'error',
          runId: errRunId,
          message: `unknown skill: /${slashCmd.name}`,
          at: now(),
        });
        return;
      }
      const workspace = before.workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) {
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, taskId, {
          kind: 'error',
          runId: errRunId,
          message: `workspace not found: ${session.workspaceId}`,
          at: now(),
        });
        return;
      }
      try {
        const result = await resolveSkillInvocation({
          skill,
          args: slashCmd.args,
          workingDir,
          workspaceRoot: workspace.rootPath,
        });
        resolvedPrompt = result.resolvedPrompt;
        const skillRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, taskId, {
          kind: 'skill_invocation',
          runId: skillRunId,
          skillName: result.skillName,
          args: result.args,
          at: now(),
        });
      } catch (err) {
        const message = formatError(err);
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, taskId, {
          kind: 'error',
          runId: errRunId,
          message,
          at: now(),
        });
        return;
      }
    }

    let phaseDefinition: Step | null = null;
    let phasePromptCarryForward = '';
    let phaseTransitionEvent: Extract<TurnEvent, { kind: 'step_transition' }> | null = null;
    let parallelDispatch: {
      template: Workflow;
      currentDef: Step;
      groupDefs: ReadonlyArray<Step>;
    } | null = null;
    // Capture user prompt PRE phase build — needed if parallel branch fires, so per-def
    // prompts can be rebuilt inside runParallelBranch.
    const userPromptForPhase = resolvedPrompt;

    if (session.workflowId) {
      const templates = get().phaseTemplates[session.workspaceId] ?? [];
      const template = templates.find((t) => t.id === session.workflowId) ?? null;
      if (template) {
        const freshRuns = await invokePhaseRunList(taskId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: freshRuns },
        }));
        // Resolve the step the next turn should land on. Auto-advance is gone:
        // currentStep keeps the agent on its current role until the user
        // explicitly spawns a new agent from the sidebar. Multiple turns
        // stack on the same Session row instead of inserting a fresh row
        // per message.
        const nextDef = currentStep(template, freshRuns);
        if (nextDef) {
          const sortedDefs = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
          const prevDef =
            sortedDefs
              .filter((d) => d.ordinal < nextDef.ordinal)
              .reverse()
              .find((d) => freshRuns.some((r) => r.stepId === d.id && r.status === 'completed')) ??
            null;
          const prevRun = prevDef
            ? (freshRuns.find((r) => r.stepId === prevDef.id && r.status === 'completed') ?? null)
            : null;
          // Carry-forward + transition event only fire on the *first* turn of a
          // step. Subsequent iterations on the same step skip both, so the
          // prompt isn't bloated by duplicating the previous step's summary on
          // every message and the transcript doesn't show a phantom step
          // transition mid-conversation.
          const isFirstTurnOfStep = !freshRuns.some((r) => r.stepId === nextDef.id);
          if (prevDef && prevRun && isFirstTurnOfStep) {
            const propagator = new WorkflowPropagator({
              summarizer: { summarizePhaseOutput: async (text) => text },
            });
            const transition = await propagator.buildTransition({
              fromOrdinal: prevDef.ordinal,
              toOrdinal: nextDef.ordinal,
              completedPhaseOutput: prevRun.outputSummary ?? '',
              existingSlots: get().sessionSlots[taskId] ?? [],
              at: now(),
            });
            phasePromptCarryForward = transition.carryForwardContext;
            phaseTransitionEvent = {
              kind: 'step_transition',
              runId: 'pending' as ProviderRunId,
              fromStep: { ordinal: prevDef.ordinal, name: prevDef.name },
              toStep: { ordinal: nextDef.ordinal, name: nextDef.name },
              carryForwardContext: transition.carryForwardContext,
              at: transition.at,
            };
          }
          phaseDefinition = nextDef;

          // Detect parallel group — only when experimental flag is on AND nextDef
          // belongs to a group with >= 2 siblings. Defer prompt rebuild for parallel
          // path: per-def prompts are built inside runParallelBranch using
          // userPromptForPhase + phasePromptCarryForward.
          const enableParallelRaw = get().settings[SETTING_ENABLE_PARALLEL_AGENTS];
          const enableParallel = enableParallelRaw === 'true';
          if (enableParallel) {
            const detection = detectParallelGroup(template, nextDef);
            if (detection !== null) {
              parallelDispatch = {
                template,
                currentDef: detection.currentDef,
                groupDefs: detection.groupDefs,
              };
            }
          }

          if (parallelDispatch === null) {
            resolvedPrompt = buildStepPrompt({
              definition: nextDef,
              carryForwardContext: phasePromptCarryForward,
              userMessage: resolvedPrompt,
            });
          }
        }
      }
    }

    const connectedProviders = get()
      .providers.filter((p) => p.connection === 'connected')
      .map((p) => p.id);

    const phaseOverride: TurnProviderOverride | undefined = phaseDefinition?.providerOverride
      ? {
          providerId: phaseDefinition.providerOverride,
          ...(phaseDefinition.modelOverride !== undefined && {
            model: phaseDefinition.modelOverride,
          }),
        }
      : undefined;
    const turnOverride =
      session.providerPreference.allowTurnOverride && override != null ? override : undefined;
    const effectiveOverride = phaseOverride ?? turnOverride;

    const routingDecision = await resolveProviderForTurn(
      session.providerPreference,
      effectiveOverride,
      connectedProviders,
    );

    if (routingDecision.reason === 'all-exceeded') {
      const runId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, taskId, {
        kind: 'error',
        runId,
        message:
          'All providers have exceeded their budget cap. Adjust budget rules or wait for the next billing period.',
        at: now(),
      });
      return;
    }

    const provider: ProviderId = routingDecision.selectedProvider;
    const agentKindModel = get().agentModelOverride[activeAgentId] ?? null;
    const model =
      phaseDefinition?.modelOverride && phaseDefinition.providerOverride === undefined
        ? phaseDefinition.modelOverride
        : (agentKindModel ?? routingDecision.selectedModel);

    const authState = get().authResults?.[provider] ?? null;
    if (authState?.state === 'disconnected') {
      const runId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, taskId, {
        kind: 'error',
        runId,
        message: encodeAuthRequiredMessage({ providerId: provider, identity: authState.identity }),
        at: now(),
      });
      return;
    }

    const resolvedOverride =
      session.providerPreference.allowTurnOverride && override != null ? override : undefined;

    // The single-run setup (user message persist, provider run row, phase run row,
    // session.state=running) is gated when the parallel branch will fire below —
    // the parallel branch inserts its own phase_run rows (one per sibling) and
    // handles user-message + session-state itself. Without this gate we'd duplicate
    // every row. The runId allocated here is still used as a placeholder for the
    // gated paths so types stay consistent (it is unused if parallelDispatch fires).
    const runId = crypto.randomUUID() as ProviderRunId;
    const isFirstTurn = (get().agentRunHistory[activeAgentId] ?? []).length === 0;

    if (parallelDispatch === null) {
      set((state) => {
        const prev = state.agentRunHistory[activeAgentId] ?? [];
        if (prev.includes(runId)) return state;
        return {
          agentRunHistory: { ...state.agentRunHistory, [activeAgentId]: [...prev, runId] },
        };
      });
      const userMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        taskId,
        agentId: activeAgentId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
        ...(resolvedOverride !== undefined ? { providerOverride: resolvedOverride } : {}),
      };
      await insertMessage(tauriDatabase, userMessage);
      get().appendTurnEvent(activeAgentId, taskId, {
        kind: 'user_text',
        runId,
        text: userTurnText,
        at: userMessage.createdAt,
      });

      const run: ProviderRun = {
        id: runId,
        taskId,
        provider,
        model,
        status: { kind: 'streaming', startedAt: now() },
        routingDecision,
        createdAt: now(),
      };
      await insertProviderRun(tauriDatabase, run);
    }

    let sessionId: SessionId | null = null;
    if (phaseDefinition && parallelDispatch === null) {
      // Reuse the existing Session row for this step if one already exists.
      // Agent-multi-turn: every turn flips the same row to running and points
      // it at the new providerRunId, instead of inserting a fresh row per
      // user message. New rows only appear when the user spawns a new agent.
      const runsForTask = get().sessionPhaseRuns[taskId] ?? [];
      const reusable = findReusableSession(runsForTask, phaseDefinition.id);
      let resolved: Session;
      if (reusable) {
        resolved = await invokePhaseRunUpdateStatus(reusable.id, {
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
        });
      } else {
        resolved = await invokePhaseRunInsert({
          taskId,
          stepId: phaseDefinition.id,
          ordinal: phaseDefinition.ordinal,
          name: phaseDefinition.name,
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
        });
      }
      sessionId = resolved.id;
      const refreshedRuns = await invokePhaseRunList(taskId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: refreshedRuns },
      }));
      if (phaseTransitionEvent) {
        get().appendTurnEvent(activeAgentId, taskId, { ...phaseTransitionEvent, runId });
      }
    } else if (!phaseDefinition && parallelDispatch === null) {
      const manualAgentId = get().selectedAgentId[taskId] ?? null;
      if (manualAgentId) {
        await invokePhaseRunUpdateStatus(manualAgentId, {
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
        });
        sessionId = manualAgentId;
        const refreshedRuns = await invokePhaseRunList(taskId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: refreshedRuns },
        }));
      }
    }

    if (parallelDispatch === null) {
      let nextState: TurnState = session.state;
      if (nextState.kind === 'draft') {
        nextState = turnReducer(nextState, { kind: 'start', at: now() });
      }
      if (nextState.kind === 'error') {
        nextState = turnReducer(nextState, { kind: 'retry', at: now() });
      }
      nextState = turnReducer(nextState, { kind: 'send', runId, at: now() });
      await updateTaskState(tauriDatabase, taskId, nextState, now());
      applySessionUpdate(set, taskId, nextState, activeAgentId);
    }

    const providerInfo = get().providers.find((p) => p.id === provider);

    let claudeFlags: Partial<ClaudeFlagSet> = {};
    let effectiveRules: ReadonlyArray<PermissionRule> = [];
    if (provider === 'anthropic') {
      try {
        const [globalRules, workspaceRules, sessionRules] = await Promise.all([
          invokePermissionRuleList({ scope: 'global' }),
          invokePermissionRuleList({ scope: 'workspace', workspaceId: session.workspaceId }),
          invokePermissionRuleList({ scope: 'task', taskId }),
        ]);
        effectiveRules = [...globalRules, ...workspaceRules, ...sessionRules];
        const flags = buildClaudeFlags({
          rules: effectiveRules,
          scope: { workspaceId: session.workspaceId, taskId },
          permissionMode: session.permissionMode,
        });
        claudeFlags = {
          allowedTools: flags.allowedTools,
          disallowedTools: flags.disallowedTools,
          permissionMode: flags.permissionMode,
        };
      } catch (err) {
        console.error('permission rule load failed; falling back to empty rule set', err);
        claudeFlags = {
          allowedTools: [],
          disallowedTools: [],
          permissionMode: 'bypassPermissions',
        };
      }
    }

    // Parallel-agents branch — triggered iff: enableParallelAgents on + phaseTemplate active + current
    // phase has parallelGroup with >= 2 siblings (already resolved above).
    // Pre-flight: aggregate cost = single-run estimate × N. Existing single-run
    // pre-flight is the routing decision itself (resolveProviderForTurn already
    // selected the cheapest viable provider). For N runs we can only enforce a
    // soft N-multiplier check against budget rules — implemented as a guard
    // against runaway parallel spend if the user's session budget is set.
    if (parallelDispatch !== null) {
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) {
        get().appendTurnEvent(activeAgentId, taskId, {
          kind: 'error',
          runId: crypto.randomUUID() as ProviderRunId,
          message: `workspace not found: ${session.workspaceId}`,
          at: now(),
        });
        return;
      }

      const maxParallelismRaw = get().settings[SETTING_MAX_PARALLELISM];
      const parsedMax = Number.parseInt(maxParallelismRaw ?? '', 10);
      const maxParallelism = Number.isFinite(parsedMax)
        ? Math.min(MAX_PARALLELISM, Math.max(MIN_PARALLELISM, parsedMax))
        : DEFAULT_MAX_PARALLELISM;
      const N = Math.min(parallelDispatch.groupDefs.length, maxParallelism);

      const sessBudget = get().sessionBudgets[taskId];
      if (sessBudget) {
        const tele = get().sessionTelemetry[taskId] ?? [];
        const lastTurnCost = tele.length > 0 ? (tele[tele.length - 1]?.estimatedCostUsd ?? 0) : 0;
        const projected = lastTurnCost * N;
        const sessSpent = (get().sessionSummary?.estimatedCostUsd ?? 0) + projected;
        if (lastTurnCost > 0 && sessSpent > sessBudget.softCapUsd) {
          get().appendTurnEvent(activeAgentId, taskId, {
            kind: 'error',
            runId: crypto.randomUUID() as ProviderRunId,
            message: `parallel turn aborted: projected spend (${sessSpent.toFixed(4)} USD) would exceed session soft cap (${sessBudget.softCapUsd.toFixed(4)} USD).`,
            at: now(),
          });
          return;
        }
      }

      const userMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        taskId,
        agentId: activeAgentId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, userMessage);

      const groupSessionRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, taskId, {
        kind: 'user_text',
        runId: groupSessionRunId,
        text: userTurnText,
        at: userMessage.createdAt,
      });
      let nextStateP: TurnState = session.state;
      if (nextStateP.kind === 'draft') {
        nextStateP = turnReducer(nextStateP, { kind: 'start', at: now() });
      }
      if (nextStateP.kind === 'error') {
        nextStateP = turnReducer(nextStateP, { kind: 'retry', at: now() });
      }
      nextStateP = turnReducer(nextStateP, {
        kind: 'send',
        runId: groupSessionRunId,
        at: now(),
      });
      await updateTaskState(tauriDatabase, taskId, nextStateP, now());
      applySessionUpdate(set, taskId, nextStateP, activeAgentId);

      const effects: ParallelBranchEffects = {
        appendTurnEvent: (agentId, sid, ev) => get().appendTurnEvent(agentId, sid, ev),
        refreshPhaseRuns: async (sid) => {
          const runs = await invokePhaseRunList(sid);
          set((state) => ({
            sessionPhaseRuns: { ...state.sessionPhaseRuns, [sid]: runs },
          }));
        },
        setMergeConflicts: (sid, conflicts) => get().setSessionMergeConflicts(sid, conflicts),
      };

      try {
        const result = await runParallelBranch(
          {
            session,
            orchestratingAgentId: activeAgentId,
            workspace,
            currentDef: parallelDispatch.currentDef,
            groupDefs: parallelDispatch.groupDefs,
            workingDir,
            resolvedPromptBase: userPromptForPhase,
            carryForwardContext: phasePromptCarryForward,
            mergeStrategy: 'last_write_wins',
            maxParallelism,
          },
          {
            now,
            providerBinary: providerInfo?.binary,
            model,
            ...(claudeFlags.permissionMode !== undefined && {
              permissionMode: claudeFlags.permissionMode,
            }),
            ...(claudeFlags.allowedTools !== undefined && {
              allowedTools: claudeFlags.allowedTools,
            }),
            ...(claudeFlags.disallowedTools !== undefined && {
              disallowedTools: claudeFlags.disallowedTools,
            }),
            effects,
          },
        );

        if (result.allFailed) {
          // Don't auto-cleanup worktrees on full failure — user inspects per-run state.
          // (Currently no per-run worktrees are created in v1; comment kept for the
          // follow-on that wires createParallelWorktrees end-to-end.)
          const errorState: TurnState = {
            kind: 'error',
            message: 'all parallel runs failed',
            failedAt: now(),
          };
          await updateTaskState(tauriDatabase, taskId, errorState, now());
          applySessionUpdate(set, taskId, errorState, activeAgentId);
        } else {
          await updateTaskState(
            tauriDatabase,
            taskId,
            turnReducer(get().sessions.find((s) => s.id === taskId)?.state ?? nextStateP, {
              kind: 'receive_event',
              event: { kind: 'done', runId: result.runIds[0]!, at: now() },
            }),
            now(),
          );
        }
      } catch (err) {
        const rawMessage = formatError(err);
        get().appendTurnEvent(activeAgentId, taskId, {
          kind: 'error',
          runId: groupSessionRunId,
          message: rawMessage,
          at: now(),
        });
        const errorState: TurnState = {
          kind: 'error',
          message: rawMessage,
          failedAt: now(),
        };
        await updateTaskState(tauriDatabase, taskId, errorState, now());
        applySessionUpdate(set, taskId, errorState, activeAgentId);
        throw err;
      }
      return;
    }
    void refreshPricingTable();

    // ContextPanel acts as the Task's shared memory: prepend the serialized
    // slots + a marker hint so the agent (a) sees what previous agents in
    // this Task already learned, and (b) knows how to write back via
    // <<ctx-decision>> / <<ctx-question>> markers parsed in the auto-populate
    // step after the turn ends.
    // Stale slots are acceptable: do NOT await the summarizer here — doing so
    // blocks user input for up to 2s between turns (#461). The summarizer pill
    // already signals in-flight status; the next turn may use previous-cycle
    // slots and that tradeoff is explicitly accepted.
    const sharedSlots = get().sessionSlots[taskId] ?? [];

    // M1: read the agent row once here; used by M5 (provider-id check) and M3 below.
    const agentRowEarly =
      (get().sessionPhaseRuns[taskId] ?? []).find((s) => s.id === activeAgentId) ?? null;
    const earlyAgentKind = inferAgentKindFromName(agentRowEarly?.name ?? '');
    const slotFilter = slotsForKind(earlyAgentKind);
    const contextPreamble = buildContextPreamble(sharedSlots, slotFilter);
    if (contextPreamble.length > 0) {
      resolvedPrompt = `${contextPreamble}\n\n${resolvedPrompt}`;
    }

    // M5: codex/cursor have no native --resume. inject recent turn text so
    // they keep working memory. claude skips — duplicating context wastes tokens.
    const needsTextHistory = provider === 'cursor' || provider === 'codex';
    if (needsTextHistory) {
      const priorTranscripts = get().transcripts[activeAgentId] ?? [];
      const priorTurns = buildPriorTurnsBlock(priorTranscripts, 8000);
      if (priorTurns.length > 0) {
        resolvedPrompt = `${priorTurns}\n\n${resolvedPrompt}`;
      }
    }

    const verbosityHint = verbosityDirective(phaseDefinition?.verbosity ?? readVerbosity(taskId));
    resolvedPrompt = `${verbosityHint}\n\n${resolvedPrompt}`;

    // M4: soft-cap warning. heuristic only — exact tokenization requires wasm.
    const estimated = estimateTokens(resolvedPrompt);
    const ctxWindow = getModelContextWindow(model);
    if (ctxWindow !== null) {
      const ratio = estimated / ctxWindow;
      if (ratio >= 0.85) {
        const pct = Math.round(ratio * 100);
        const msg = `ctx estimate: ${estimated.toLocaleString()} / ${ctxWindow.toLocaleString()} (${pct}%) — consider /compact`;
        if (import.meta.env.DEV) console.warn(msg);
        set((state) => ({
          systemAlerts: [
            ...state.systemAlerts,
            {
              id: crypto.randomUUID(),
              kind: 'context-soft-cap' as const,
              message: msg,
              createdAt: now(),
            },
          ],
        }));
      }
    }

    let assistantText = '';
    let lastError: unknown = null;
    const filesTouchedThisTurn = new Set<string>();

    // M1: thread the per-agent provider session id so claude `--resume`s and
    // keeps prior-turn context across one-shot CLI invocations.
    const resumeSessionId = agentRowEarly?.providerSessionId;

    // M3: per-kind system prompt — biases planner/implementer/debugger toward
    // their role. Only claude consumes it today; other providers ignore the
    // arg downstream.
    const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

    try {
      for await (const event of runTurn({
        runId,
        provider,
        model,
        workingDir,
        prompt: resolvedPrompt,
        binary: providerInfo?.binary,
        ...(resumeSessionId !== undefined && { resumeSessionId }),
        ...(kindSystemPrompt !== undefined && { systemPrompt: kindSystemPrompt }),
        ...claudeFlags,
      })) {
        get().appendTurnEvent(activeAgentId, taskId, event);
        if (event.kind === 'assistant_text') assistantText += event.delta;
        if (event.kind === 'file_edit') filesTouchedThisTurn.add(toRelPath(event.path, workingDir));

        if (provider === 'anthropic' && event.kind === 'tool_call_start') {
          const engine = new PermissionEngine();
          const auditRequestId = crypto.randomUUID() as PermissionRequestId;
          const request: PermissionRequest = {
            id: auditRequestId,
            runId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            input: event.input,
            at: event.at,
          };
          const volatile = get().volatilePermissionAllows;
          const isVolatileAllow = volatile.has(event.toolUseId);
          if (isVolatileAllow) {
            set((state) => {
              const next = new Set(state.volatilePermissionAllows);
              next.delete(event.toolUseId);
              return { volatilePermissionAllows: next };
            });
          }
          const decision: PermissionDecision = isVolatileAllow
            ? {
                requestId: auditRequestId,
                decision: 'allow',
                ruleId: null,
                decidedBy: 'user',
                at: event.at,
              }
            : engine.decide(request, effectiveRules, {
                taskId,
                workspaceId: session.workspaceId,
              });
          const auditPayload: PermissionAuditInsertPayload = {
            id: auditRequestId,
            runId,
            taskId,
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            inputJson: JSON.stringify(event.input),
            decision: decision.decision,
            ...(decision.ruleId != null && { ruleId: decision.ruleId }),
            decidedBy: decision.decidedBy,
            requestedAt: event.at,
            decidedAt: decision.at,
          };
          try {
            await invokePermissionAuditInsert(auditPayload);
          } catch {
            // Insert failed — persist to retry queue so the audit trail is
            // not silently dropped. JS single-threaded event loop makes the
            // sequential await sufficient as a single-writer guard.
            try {
              await invokeAuditRetryEnqueue(auditRequestId, JSON.stringify(auditPayload));
            } catch (enqueueErr) {
              console.error('permission audit retry enqueue failed', enqueueErr);
            }
          }
        }

        if (event.kind === 'usage') {
          const cost = (() => {
            if (provider === 'codex') {
              return computeCodexCostUsd(event.usage, model, getCodexPriceOverride(null, model));
            }
            if (provider === 'cursor') return computeCursorCostUsd(event.usage, model);
            return computeCostUsd(event.usage, model);
          })();
          const record: TelemetryRecord = {
            id: crypto.randomUUID() as TelemetryRecordId,
            runId,
            taskId,
            kind: 'turn',
            provider,
            model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            estimatedCostUsd: cost,
            recordedAt: now(),
          };
          await insertTelemetry(tauriDatabase, record);
          set((state) => ({
            sessionTelemetry: {
              ...state.sessionTelemetry,
              [taskId]: [...(state.sessionTelemetry[taskId] ?? []), record],
            },
          }));
          const session = get().sessions.find((s) => s.id === taskId);
          if (session) {
            const [sessSummary, wsSummary, providerSummaries, budgetRules, freshAlerts] =
              await Promise.all([
                summarizeTaskTelemetry(tauriDatabase, taskId),
                summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
                summarizeWorkspaceProviderTelemetry(tauriDatabase, session.workspaceId),
                invokeBudgetRuleList(),
                invokeBudgetAlertsList(),
              ]);
            const knownIds = new Set(get().budgetAlerts.map((a) => a.id));
            const newAlerts = freshAlerts.filter((a) => !knownIds.has(a.id));
            set({
              sessionSummary: sessSummary,
              workspaceSummary: wsSummary,
              providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
              budgetAlerts: freshAlerts,
            });
            if (newAlerts.length > 0 && onNewAlerts) onNewAlerts(newAlerts);
          }
        }

        const current = get().sessions.find((s) => s.id === taskId);
        if (current) {
          const reduced = turnReducer(current.state, { kind: 'receive_event', event });
          if (reduced !== current.state) {
            await updateTaskState(tauriDatabase, taskId, reduced, now());
            applySessionUpdate(set, taskId, reduced, activeAgentId);
          }
        }
      }
      // Stream ended without a 'done'/'error' event — provider CLI exited
      // cleanly but didn't emit a `result` line, so the reducer never left
      // 'running'. Force-idle so input re-enables.
      const afterStream = get().sessions.find((s) => s.id === taskId);
      if (afterStream?.state.kind === 'running') {
        const idleState: TurnState = { kind: 'idle', lastActivityAt: now() };
        await updateTaskState(tauriDatabase, taskId, idleState, now());
        applySessionUpdate(set, taskId, idleState, activeAgentId);
        if (assistantText.length === 0) {
          get().appendTurnEvent(activeAgentId, taskId, {
            kind: 'error',
            runId,
            message:
              'provider exited without a response. check that the CLI is configured correctly.',
            at: now(),
          });
        }
      }
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'succeeded',
        finishedAt: now(),
      });
      if (sessionId) {
        await invokePhaseRunUpdateStatus(sessionId, {
          status: 'completed',
          outputSummary: assistantText.slice(0, 2000),
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(taskId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: refreshedRuns },
          ...(phaseDefinition && {
            sessions: state.sessions.map((s) =>
              s.id === taskId ? { ...s, currentStepOrdinal: phaseDefinition.ordinal } : s,
            ),
          }),
        }));
        void get().maybeAutoAdvanceWorkflow(taskId);
      }

      // Auto-populate ContextPanel from this turn's output: file paths come
      // from file_edit events; <<ctx-decision>> / <<ctx-question>> markers come
      // from the assistant text. Best-effort — slot writes failing must not
      // mask the turn itself.
      try {
        const result = await autoPopulateContext({
          db: tauriDatabase,
          taskId,
          filesEdited: Array.from(filesTouchedThisTurn),
          assistantText,
        });
        if (result.updatedSlots.length > 0) {
          const refreshedSlots = await listContextSlotsForTask(tauriDatabase, taskId);
          set((state) => ({
            sessionSlots: { ...state.sessionSlots, [taskId]: refreshedSlots },
          }));
        }
      } catch (e) {
        console.error('autoPopulateContext failed', e);
      }
    } catch (err) {
      lastError = err;
      const rawMessage = formatError(err);
      const isAuthErr = isAuthErrorMessage(rawMessage);
      const message = isAuthErr
        ? encodeAuthRequiredMessage({
            providerId: provider,
            identity: get().authResults?.[provider]?.identity ?? null,
          })
        : rawMessage;
      const errorState: TurnState = {
        kind: 'error',
        message: rawMessage,
        failedAt: now(),
      };
      await updateTaskState(tauriDatabase, taskId, errorState, now());
      applySessionUpdate(set, taskId, errorState, activeAgentId);
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: rawMessage,
      });
      get().appendTurnEvent(activeAgentId, taskId, {
        kind: 'error',
        runId,
        message,
        at: now(),
      });
      if (sessionId) {
        await invokePhaseRunUpdateStatus(sessionId, {
          status: 'failed',
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(taskId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: refreshedRuns },
        }));
      }
    }

    if (assistantText.length > 0) {
      const assistantMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        taskId,
        agentId: activeAgentId,
        role: 'assistant',
        content: assistantText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, assistantMessage);
    }

    if (!lastError && assistantText.length > 0) {
      enqueueSummarizer(set, get, taskId, resolvedPrompt, assistantText);
      void capturePlanFromTurn(set, taskId, activeAgentId, assistantText);
      if (
        !get().sessionGithub[taskId]?.pr &&
        /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/.test(assistantText)
      ) {
        void get()
          .refreshSessionPr(taskId, { force: true })
          .then(() => void get().refreshSessionPrDetail(taskId, { force: true }));
      }
      if (isFirstTurn) {
        const sessionForTitle = get().sessions.find((s) => s.id === taskId);
        const titleEditable = sessionForTitle ? !sessionForTitle.titleUserEdited : false;
        // Only auto-rename agents whose name still matches the default
        // `agent N` pattern — workflow-step names and user edits stay.
        const agentRecord = (get().sessionPhaseRuns[taskId] ?? []).find(
          (r) => r.id === activeAgentId,
        );
        const agentNameEditable = agentRecord ? /^agent \d+$/i.test(agentRecord.name) : false;
        if (sessionForTitle && (titleEditable || agentNameEditable)) {
          void generateAutoTitle(
            set,
            get,
            taskId,
            resolvedPrompt,
            assistantText,
            agentNameEditable ? activeAgentId : null,
          );
        }
      }
    }

    if (lastError) throw lastError;
  },

  cancelCurrentTurn: async (taskId) => {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session || session.state.kind !== 'running') return;
    const cancelAgentId = get().selectedAgentId[taskId] ?? null;
    await cancelTurn(session.state.runId).catch(() => undefined);
    const now = new Date().toISOString() as IsoDateTime;
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    await updateTaskState(tauriDatabase, taskId, idleState, now).catch(() => undefined);
    applySessionUpdate(set, taskId, idleState, cancelAgentId ?? undefined);
  },

  refreshWorkspaceSummary: async (workspaceId) => {
    const [summary, providerSummaries, budgetRules] = await Promise.all([
      summarizeWorkspaceTelemetry(tauriDatabase, workspaceId),
      summarizeWorkspaceProviderTelemetry(tauriDatabase, workspaceId),
      invokeBudgetRuleList(),
    ]);
    set({
      workspaceSummary: summary,
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    });
  },

  loadSessionTelemetry: async (taskId) => {
    const records = await listTelemetryForTask(tauriDatabase, taskId);
    set((state) => ({
      sessionTelemetry: { ...state.sessionTelemetry, [taskId]: records },
    }));
  },

  loadSessionSlots: async (taskId) => {
    const slots = await listContextSlotsForTask(tauriDatabase, taskId);
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [taskId]: slots },
    }));
  },

  upsertSessionSlot: async (taskId, key, value) => {
    const existing = get().sessionSlots[taskId] ?? [];
    const prev = existing.find((s) => s.key === key);
    if (prev && prev.value !== value) {
      await insertContextSlotHistory(
        tauriDatabase,
        taskId,
        crypto.randomUUID(),
        key,
        prev.value,
        'user',
      );
    }
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    await upsertContextSlot(tauriDatabase, taskId, next);
    const refreshedHistory = await listContextSlotHistory(tauriDatabase, taskId, key);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [taskId]: mergeSlots(state.sessionSlots[taskId] ?? [], next),
      },
      slotHistory: {
        ...state.slotHistory,
        [taskId]: {
          ...(state.slotHistory[taskId] ?? {}),
          [key]: refreshedHistory,
        },
      },
    }));
  },

  loadSlotHistory: async (taskId, key) => {
    const entries = await listContextSlotHistory(tauriDatabase, taskId, key);
    set((state) => ({
      slotHistory: {
        ...state.slotHistory,
        [taskId]: {
          ...(state.slotHistory[taskId] ?? {}),
          [key]: entries,
        },
      },
    }));
  },

  loadDiffComments: async (taskId) => {
    // Cache hit short-circuit: ContextPanel mounts on every session switch
    // and fires this effect; without the guard the ~1s DB query repeats
    // even when the data is already in store. Mutations (add/resolve/delete)
    // refresh the slice directly, so the cache stays accurate.
    if (get().diffComments[taskId] !== undefined) return;
    const comments = await listDiffCommentsForTask(tauriDatabase, taskId);
    set((state) => ({
      diffComments: { ...state.diffComments, [taskId]: comments },
    }));
  },

  addDiffComment: async (taskId, filePath, body, anchor) => {
    const id = crypto.randomUUID();
    await insertDiffComment(tauriDatabase, id, taskId, filePath, body, anchor);
    const comments = await listDiffCommentsForTask(tauriDatabase, taskId);
    set((state) => ({
      diffComments: { ...state.diffComments, [taskId]: comments },
    }));
  },

  resolveDiffComment: async (taskId, commentId) => {
    await dbResolveDiffComment(tauriDatabase, commentId);
    const comments = await listDiffCommentsForTask(tauriDatabase, taskId);
    set((state) => ({
      diffComments: { ...state.diffComments, [taskId]: comments },
    }));
  },

  deleteDiffComment: async (taskId, commentId) => {
    await dbDeleteDiffComment(tauriDatabase, commentId);
    const comments = await listDiffCommentsForTask(tauriDatabase, taskId);
    set((state) => ({
      diffComments: { ...state.diffComments, [taskId]: comments },
    }));
  },

  loadNotifications: async () => {
    const notifications = await listNotifications(tauriDatabase);
    set({ notifications });
  },

  emitNotification: async (kind, severity, title, body, opts) => {
    const n: Notification = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString() as IsoDateTime,
      kind,
      title,
      body: body ?? null,
      severity,
      sessionId: opts?.sessionId ?? null,
      workspaceId: opts?.workspaceId ?? null,
      read: false,
    };
    await insertNotification(tauriDatabase, n);
    set((state) => ({ notifications: [n, ...state.notifications] }));
  },

  markNotificationsRead: async () => {
    await markAllNotificationsRead(tauriDatabase);
    set((state) => ({
      notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
    }));
  },

  clearNotifications: async () => {
    await clearAllNotifications(tauriDatabase);
    set({ notifications: [] });
  },

  loadSessionPlans: async (taskId) => {
    const plans = await invokeListPlansForSession(taskId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [taskId]: plans },
    }));
  },

  setPlanStatus: async (taskId, planId, status) => {
    await invokeSetPlanStatus(planId, status);
    const refreshed = await invokeListPlansForSession(taskId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [taskId]: refreshed },
    }));
  },

  updatePlanBody: async (taskId, planId, title, bodyMd) => {
    await invokeSetPlanBody(planId, title, bodyMd);
    const refreshed = await invokeListPlansForSession(taskId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [taskId]: refreshed },
    }));
  },

  deletePlan: async (taskId, planId) => {
    await invokeDeletePlan(planId);
    const refreshed = await invokeListPlansForSession(taskId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [taskId]: refreshed },
    }));
  },

  toggleSessionSlot: async (taskId, key, enabled) => {
    const existing = get().sessionSlots[taskId] ?? [];
    const prev = existing.find((s) => s.key === key);
    const next: ContextSlot = { key, value: prev?.value ?? '', enabled };
    await upsertContextSlot(tauriDatabase, taskId, next);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [taskId]: mergeSlots(state.sessionSlots[taskId] ?? [], next),
      },
    }));
  },

  endSession: async (taskId) => {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) throw new Error(`session not found: ${taskId}`);
    if (session.state.kind === 'ended') return;
    if (session.state.kind === 'running') {
      // Best-effort cancel — Rust TurnRegistry may have already removed the
      // run (process exited, app restarted, etc). A "turn not found" error
      // here must not block end-session: the session row is the source of
      // truth, not the in-memory registry.
      await cancelTurn(session.state.runId).catch(() => undefined);
    }

    const worktreePaths = get().sessionWorktrees[taskId] ?? [];
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (workspace) {
      for (const worktreePath of worktreePaths) {
        try {
          await removeWorktree(workspace.rootPath, worktreePath);
        } catch (err) {
          // worktree may already be gone — surface as warning, continue ending
          console.warn(`worktree_remove failed: ${formatError(err)}`);
        }
      }
    }
    await deleteWorktreesForTask(tauriDatabase, taskId);

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;
    const ended: TurnState = turnReducer(session.state, { kind: 'end', at: now() });
    await updateTaskState(tauriDatabase, taskId, ended, now());
    const allAgents = get().sessionPhaseRuns[taskId] ?? [];
    set((state) => {
      const next = { ...state.agentTurnState };
      for (const agent of allAgents) next[agent.id] = ended;
      return { agentTurnState: next };
    });
    applySessionUpdate(set, taskId, ended);

    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[taskId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[taskId];
      return { sessionWorktrees: nextWorktrees, sessionBranches: nextBranches };
    });
  },

  loadBudgetRules: async () => {
    const rules = await invokeBudgetRuleList();
    set({ budgetRules: rules });
  },

  saveBudgetRule: async (partial) => {
    const now = new Date().toISOString() as IsoDateTime;
    const rule: BudgetRule = {
      id: crypto.randomUUID(),
      createdAt: now,
      ...partial,
    };
    await invokeBudgetRuleUpsert(rule);
    const rules = await invokeBudgetRuleList();
    set({ budgetRules: rules });
  },

  deleteBudgetRule: async (id) => {
    await invokeBudgetRuleDelete(id);
    set((state) => ({ budgetRules: state.budgetRules.filter((r) => r.id !== id) }));
  },

  loadSessionBudget: async (taskId) => {
    const budget = await invokeSessionBudgetGet(taskId);
    if (budget !== null) {
      set((state) => ({
        sessionBudgets: { ...state.sessionBudgets, [taskId]: budget },
      }));
    }
  },

  setSessionBudget: async (taskId, softCapUsd) => {
    await invokeSessionBudgetSet(taskId, softCapUsd);
    const budget: TaskBudget = { taskId, softCapUsd };
    set((state) => ({
      sessionBudgets: { ...state.sessionBudgets, [taskId]: budget },
    }));
  },

  addWorkspace: async ({ rootPath, name }) => {
    const check = await validateGitRepo(rootPath);
    if (!check.isRepo || !check.rootPath) {
      throw new Error(check.error ?? 'not a git repository');
    }
    const resolvedRoot = check.rootPath;

    // Surface a friendly error if the repo is already registered, instead of leaking
    // SQLite's UNIQUE constraint violation as `[object Object]` to the dialog.
    const existing = get().workspaces.find((w) => w.rootPath === resolvedRoot);
    if (existing) {
      throw new Error(`workspace already exists: ${existing.name}`);
    }

    const inferredName =
      name?.trim() || resolvedRoot.split('/').filter(Boolean).at(-1) || 'workspace';
    const now = new Date().toISOString() as IsoDateTime;
    const workspace: Workspace = {
      id: crypto.randomUUID() as WorkspaceId,
      name: inferredName,
      rootPath: resolvedRoot,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await insertWorkspace(tauriDatabase, workspace);
    } catch (err) {
      const msg = formatError(err);
      if (msg.toLowerCase().includes('unique')) {
        throw new Error(`workspace already exists at ${resolvedRoot}`);
      }
      throw new Error(`failed to register workspace: ${msg}`);
    }
    set((state) => ({ workspaces: [workspace, ...state.workspaces] }));

    // Seed default workflow library so the new-task wizard always has presets.
    try {
      await seedWorkflowLibrary({ db: tauriDatabase }, workspace.id);
      const templates = await invokePhaseTemplateList(workspace.id);
      set((state) => ({
        phaseTemplates: { ...state.phaseTemplates, [workspace.id]: templates },
      }));
    } catch {
      // Workflow seeding must not block workspace creation; user can edit later.
    }

    // Auto-discover skills on disk so freshly linked repos work
    // without forcing the user to click "rescan" in Settings.
    try {
      const skills = await invokeSkillRescan(workspace.id);
      set((state) => ({ skills: { ...state.skills, [workspace.id]: skills } }));
    } catch {
      // Discovery failure must not block workspace creation; user can rescan from Settings.
    }

    return workspace;
  },

  deleteWorkspace: async (id) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === id);
    if (!workspace) throw new Error(`workspace not found: ${id}`);

    const sessions = await listTasksForWorkspace(tauriDatabase, id);
    const aliveSessions = sessions.filter(
      (s) => s.state.kind === 'running' || s.state.kind === 'idle',
    );
    if (aliveSessions.length > 0) {
      throw new Error(
        `${aliveSessions.length} session${aliveSessions.length > 1 ? 's are' : ' is'} still running or idle. end them before deleting this workspace.`,
      );
    }

    // Remove all worktrees from disk for sessions that have ended
    for (const session of sessions) {
      const worktreePaths = state.sessionWorktrees[session.id] ?? [];
      for (const worktreePath of worktreePaths) {
        try {
          await removeWorktree(workspace.rootPath, worktreePath);
        } catch {
          // worktree may already be gone — best-effort cleanup
        }
      }
    }

    // Optimistic UI update
    const prevWorkspaces = state.workspaces;
    const wasCurrentWorkspace = state.currentWorkspaceId === id;
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      ...(wasCurrentWorkspace
        ? {
            currentWorkspaceId: null,
            currentSessionId: null,
            sessions: [],
            sessionSummary: null,
            workspaceSummary: null,
            transcripts: {},
            messages: {},
            sessionTelemetry: {},
            sessionSlots: {},
            slotHistory: {},
            sessionWorktrees: {},
            sessionPhaseRuns: {},
            selectedAgentId: {},
            agentRunHistory: {},
            agentTurnState: {},
            sessionBudgets: {},
            summarizerStatus: {},
            sessionNextActions: {},
            budgetAlerts: [],
            unknownPayloadCounts: {},
          }
        : {}),
    }));

    try {
      await deleteWorkspace(tauriDatabase, id);
    } catch (err) {
      // Rollback optimistic update
      set((s) => ({
        workspaces: prevWorkspaces,
        ...(wasCurrentWorkspace ? { currentWorkspaceId: id } : {}),
      }));
      throw err;
    }
    void get().emitNotification(
      'workspace-deleted',
      'info',
      `workspace deleted: ${workspace.name}`,
      sessions.length > 0
        ? `${sessions.length} session${sessions.length === 1 ? '' : 's'} removed`
        : undefined,
    );
  },

  refreshProviderSpendBreakdown: async (workspaceId) => {
    const [providerSummaries, budgetRules] = await Promise.all([
      summarizeWorkspaceProviderTelemetry(tauriDatabase, workspaceId),
      invokeBudgetRuleList(),
    ]);
    set({ providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules) });
  },

  loadBudgetAlerts: async () => {
    const alerts = await invokeBudgetAlertsList();
    set({ budgetAlerts: alerts });
  },

  dismissBudgetAlert: async (id) => {
    await invokeBudgetAlertDismiss(id);
    set((state) => ({
      budgetAlerts: state.budgetAlerts.map((a) =>
        a.id === id ? { ...a, dismissedAt: new Date().toISOString() as IsoDateTime } : a,
      ),
    }));
  },

  loadSkills: async (workspaceId) => {
    const skills = await invokeSkillList(workspaceId);
    set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
  },

  saveSkill: async (input) => {
    await invokeSkillUpsert(input);
    const skills = await invokeSkillList(input.workspaceId);
    set((state) => ({ skills: { ...state.skills, [input.workspaceId]: skills } }));
  },

  deleteSkill: async (skillId, workspaceId) => {
    await invokeSkillDelete(skillId);
    const skills = await invokeSkillList(workspaceId);
    set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
  },

  rescanSkills: async (workspaceId) => {
    const skills = await invokeSkillRescan(workspaceId);
    set((state) => ({ skills: { ...state.skills, [workspaceId]: skills } }));
  },

  loadPhaseTemplates: async (workspaceId) => {
    const templates = await invokePhaseTemplateList(workspaceId);
    set((state) => ({ phaseTemplates: { ...state.phaseTemplates, [workspaceId]: templates } }));
  },

  savePhaseTemplate: async (template) => {
    await invokePhaseTemplateUpsert(template);
    const templates = await invokePhaseTemplateList(template.workspaceId);
    set((state) => ({
      phaseTemplates: { ...state.phaseTemplates, [template.workspaceId]: templates },
    }));
  },

  deleteWorkflow: async (id, workspaceId) => {
    await invokePhaseTemplateDelete(id);
    const templates = await invokePhaseTemplateList(workspaceId);
    set((state) => ({
      phaseTemplates: { ...state.phaseTemplates, [workspaceId]: templates },
    }));
  },

  loadPhaseRunsForSession: async (taskId) => {
    const runs = await invokePhaseRunList(taskId);
    set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: runs } }));
  },

  selectAgent: async (taskId, agentId) => {
    const cached = get().transcripts[agentId];
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(`[perf] selectAgent:${agentId} cached`);
      set((state) => {
        const current = state.sessionLoading[taskId] ?? EMPTY_LOADING;
        return {
          selectedAgentId: { ...state.selectedAgentId, [taskId]: agentId },
          sessionLoading: {
            ...state.sessionLoading,
            [taskId]: { ...current, transcript: false },
          },
        };
      });
      return;
    }
    set((state) => {
      const current = state.sessionLoading[taskId] ?? EMPTY_LOADING;
      return {
        selectedAgentId: { ...state.selectedAgentId, [taskId]: agentId },
        sessionLoading: {
          ...state.sessionLoading,
          [taskId]: { ...current, transcript: true },
        },
      };
    });
    const tMessages = performance.now();
    const tEvents = performance.now();
    try {
      const [messages, events] = await Promise.all([
        listMessagesForAgent(tauriDatabase, agentId).then((r) => {
          // eslint-disable-next-line no-console
          console.log(`[perf] selectAgent:messages ${(performance.now() - tMessages).toFixed(0)}ms`);
          return r;
        }),
        listTurnEventsForAgent(tauriDatabase, agentId).then((r) => {
          // eslint-disable-next-line no-console
          console.log(`[perf] selectAgent:events ${(performance.now() - tEvents).toFixed(0)}ms (${r.length} rows)`);
          return r;
        }),
      ]);
      set((state) => {
        const current = state.sessionLoading[taskId] ?? EMPTY_LOADING;
        return {
          transcripts: { ...state.transcripts, [agentId]: events },
          messages: { ...state.messages, [taskId]: messages },
          sessionLoading: {
            ...state.sessionLoading,
            [taskId]: { ...current, transcript: false },
          },
        };
      });
    } catch (err) {
      set((state) => {
        const current = state.sessionLoading[taskId] ?? EMPTY_LOADING;
        return {
          sessionLoading: {
            ...state.sessionLoading,
            [taskId]: { ...current, transcript: false },
          },
        };
      });
      throw err;
    }
  },

  spawnAgent: async (taskId, args) => {
    const state = get();
    const task = state.sessions.find((s) => s.id === taskId);
    if (!task) throw new Error(`session not found: ${taskId}`);
    let resolvedName = args.name;
    let stepPromptPrefix = '';
    if (args.stepId) {
      const templates = state.phaseTemplates[task.workspaceId] ?? [];
      const template = task.workflowId
        ? (templates.find((t) => t.id === task.workflowId) ?? null)
        : null;
      const step = template?.steps.find((s) => s.id === args.stepId) ?? null;
      if (step) {
        if (!resolvedName) resolvedName = step.name;
        stepPromptPrefix = step.promptPrefix;
      }
    }
    if (!resolvedName) {
      const existing = state.sessionPhaseRuns[taskId] ?? [];
      resolvedName = `agent ${existing.length + 1}`;
    }
    const currentRuns = state.sessionPhaseRuns[taskId] ?? [];
    const nextOrdinal = currentRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
    const inserted = await invokePhaseRunInsert({
      taskId,
      ...(args.stepId !== undefined && { stepId: args.stepId }),
      ordinal: nextOrdinal,
      name: resolvedName,
      status: 'pending',
    });
    const refreshed = await invokePhaseRunList(taskId);
    set((s) => ({
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [taskId]: refreshed },
      selectedAgentId: { ...s.selectedAgentId, [taskId]: inserted.id },
      transcripts: { ...s.transcripts, [inserted.id]: [] },
      messages: { ...s.messages, [taskId]: [] },
      agentTurnState: {
        ...s.agentTurnState,
        [inserted.id]: { kind: 'idle', lastActivityAt: new Date().toISOString() as IsoDateTime },
      },
      ...(args.model !== undefined && {
        agentModelOverride: { ...s.agentModelOverride, [inserted.id]: args.model },
      }),
    }));
    const baseKickoff = stepPromptPrefix.length > 0 ? stepPromptPrefix : (args.initialPrompt ?? '');
    const planSection = await buildPlanKickoffSection(taskId);
    const kickoff = composeKickoff(planSection, baseKickoff);
    if (kickoff.length > 0) {
      void get().sendTurn({ taskId, content: kickoff });
    }
    return inserted.id;
  },

  renameAgent: async (taskId, agentId, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    await tauriDatabase.execute('UPDATE sessions SET name = ? WHERE id = ?', [trimmed, agentId]);
    const refreshed = await invokePhaseRunList(taskId);
    set((s) => ({
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [taskId]: refreshed },
    }));
  },

  setAgentKind: (agentId, kind) => {
    set((s) => {
      const nextModelOverride = { ...s.agentModelOverride };
      const defaults = AGENT_KIND_DEFAULTS[kind];
      if (defaults?.model) {
        nextModelOverride[agentId] = defaults.model;
      }
      return {
        agentKindOverride: { ...s.agentKindOverride, [agentId]: kind },
        agentModelOverride: nextModelOverride,
      };
    });
  },

  setAgentDraft: (agentId, value) => {
    set((s) => ({ agentDraft: { ...s.agentDraft, [agentId]: value } }));
  },

  clearAgentDraft: (agentId) => {
    set((s) => {
      if (!(agentId in s.agentDraft)) return s;
      const next = { ...s.agentDraft };
      delete next[agentId];
      return { agentDraft: next };
    });
  },

  deleteAgent: async (taskId, agentId) => {
    await tauriDatabase.execute('DELETE FROM sessions WHERE id = ?', [agentId]);
    const refreshed = await invokePhaseRunList(taskId);
    set((s) => {
      const wasSelected = s.selectedAgentId[taskId] === agentId;
      const nextSelected = { ...s.selectedAgentId };
      if (wasSelected) {
        const fallback = refreshed[0]?.id ?? null;
        if (fallback) nextSelected[taskId] = fallback;
        else delete nextSelected[taskId];
      }
      return {
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [taskId]: refreshed },
        selectedAgentId: nextSelected,
      };
    });
  },

  wipeLocalDatabase: async () => {
    await wipeDb();
    set({
      ...initialState,
      hydrated: get().hydrated,
      bootPhase: get().bootPhase,
      providers: get().providers,
      providerStatus: get().providerStatus,
      cursorStatus: get().cursorStatus,
      codexStatus: get().codexStatus,
      authResults: get().authResults,
      detectedEditors: get().detectedEditors,
    });
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
  },

  dismissSystemAlert: (id) => {
    set((state) => ({
      systemAlerts: state.systemAlerts.filter((a) => a.id !== id),
    }));
  },

  setSessionMergeConflicts: (taskId, conflicts) => {
    set((state) => ({
      sessionMergeConflicts: { ...state.sessionMergeConflicts, [taskId]: conflicts },
    }));
  },

  resolveMergeConflicts: async (taskId, picks, runStatuses) => {
    const conflicts = get().sessionMergeConflicts[taskId] ?? [];
    await resolveConflicts({
      conflicts,
      runStatuses: runStatuses.map((rs) => ({
        runId: rs.runId as ProviderRunId,
        completedAt: rs.completedAt as IsoDateTime,
        status: rs.status as SessionStatus,
      })),
      strategy: 'manual',
      manualPicks: picks as Record<string, ProviderRunId>,
    });
    set((state) => {
      const next = { ...state.sessionMergeConflicts };
      delete next[taskId];
      return { sessionMergeConflicts: next };
    });
  },

  loadWorkspaceOverrides: async (workspaceId) => {
    const overrides = await invoke<OverrideSettings | null>('get_workspace_overrides', {
      workspaceId,
    });
    if (overrides) {
      set((state) => ({
        workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
      }));
    }
  },

  setWorkspaceOverrides: async (workspaceId, overrides) => {
    await invoke('set_workspace_overrides', { workspaceId, overrides });
    set((state) => ({
      workspaceOverrides: { ...state.workspaceOverrides, [workspaceId]: overrides },
    }));
  },

  loadSessionOverrides: async (taskId) => {
    const overrides = await invoke<OverrideSettings | null>('get_task_overrides', { taskId });
    if (overrides) {
      set((state) => ({
        sessionOverrides: { ...state.sessionOverrides, [taskId]: overrides },
      }));
    }
  },

  setTaskOverrides: async (taskId, overrides) => {
    await invoke('set_task_overrides', { taskId, overrides });
    set((state) => ({
      sessionOverrides: { ...state.sessionOverrides, [taskId]: overrides },
    }));
  },

  renameTask: async (taskId, goal) => {
    if (!goal.trim()) throw new Error('session name cannot be empty');
    const now = new Date().toISOString() as IsoDateTime;
    const prev = get().sessions.find((s) => s.id === taskId);
    if (!prev) throw new Error(`session not found: ${taskId}`);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === taskId ? { ...s, goal: goal.trim(), titleUserEdited: true, updatedAt: now } : s,
      ),
    }));
    try {
      await renameSessionInDb(tauriDatabase, taskId, goal.trim(), now, true);
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === taskId ? prev : s)),
      }));
      throw err;
    }
  },

  autoTitleSession: async (taskId, title) => {
    if (!title.trim()) return;
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session || session.titleUserEdited) return;
    const now = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === taskId ? { ...s, goal: title.trim() } : s)),
    }));
    await renameSessionInDb(tauriDatabase, taskId, title.trim(), now, false);
  },

  bulkDeleteSessionsForWorkspace: async (workspaceId, taskIds) => {
    for (const taskId of taskIds) {
      await get().deleteTask(taskId);
    }
    const remaining = get().sessions.filter((s) => s.workspaceId === workspaceId);
    if (remaining.length === 0) {
      await deleteWorkspace(tauriDatabase, workspaceId);
      set((state) => ({
        workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
        currentSessionId:
          state.currentSessionId &&
          state.sessions.find((s) => s.id === state.currentSessionId)?.workspaceId === workspaceId
            ? null
            : state.currentSessionId,
      }));
    }
  },

  deleteTask: async (taskId) => {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) throw new Error(`session not found: ${taskId}`);
    if (session.state.kind === 'running') {
      await cancelTurn((session.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(
        () => undefined,
      );
    }
    const worktreePaths = get().sessionWorktrees[taskId] ?? [];
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (workspace) {
      for (const worktreePath of worktreePaths) {
        try {
          await removeWorktree(workspace.rootPath, worktreePath);
        } catch {
          // worktree may already be gone
        }
      }
    }
    const sessionGoal = session.goal;
    const sessionWorkspaceId = session.workspaceId;
    await deleteSessionFromDb(tauriDatabase, taskId);
    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[taskId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[taskId];
      const nextTranscripts = { ...state.transcripts };
      for (const agent of state.sessionPhaseRuns[taskId] ?? []) {
        delete nextTranscripts[agent.id];
      }
      return {
        sessions: state.sessions.filter((s) => s.id !== taskId),
        currentSessionId: state.currentSessionId === taskId ? null : state.currentSessionId,
        sessionWorktrees: nextWorktrees,
        sessionBranches: nextBranches,
        transcripts: nextTranscripts,
      };
    });
    void get().emitNotification(
      'session-deleted',
      'info',
      `session deleted: ${sessionGoal}`,
      undefined,
      { workspaceId: sessionWorkspaceId },
    );
  },

  setSidebarWorkspaceSearch: (query) => set({ sidebarWorkspaceSearch: query }),
  setSidebarSessionSearch: (query) => set({ sidebarSessionSearch: query }),
  setSidebarStateFilter: (states) => set({ sidebarStateFilter: states }),
  setSidebarProviderFilter: (providers) => set({ sidebarProviderFilter: providers }),

  exportConfig: async () => {
    return exportConfigToFile();
  },

  importConfig: async () => {
    return importConfigFromFile();
  },

  refreshGithubStatus: async () => {
    try {
      const status = await ghStatus();
      set({ githubStatus: status });
    } catch (err) {
      set({
        githubStatus: {
          available: false,
          mode: 'absent',
          version: undefined,
          user: undefined,
          scopes: [],
        },
      });
      console.warn('gh_status failed', err);
    }
  },

  setGithubPat: async (token) => {
    const status = await ghSetToken(token);
    set({ githubStatus: status });
    return status;
  },

  clearGithubToken: async () => {
    await ghClearToken();
    await get().refreshGithubStatus();
  },

  refreshSessionPr: async (taskId, opts) => {
    const branch = get().sessionBranches[taskId];
    if (!branch) return;
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) return;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) return;
    set((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [taskId]: {
          pr: state.sessionGithub[taskId]?.pr ?? null,
          linkedIssues: state.sessionGithub[taskId]?.linkedIssues ?? [],
          fetchedAt: state.sessionGithub[taskId]?.fetchedAt ?? null,
          loading: true,
          error: null,
          detail: state.sessionGithub[taskId]?.detail ?? null,
          detailFetchedAt: state.sessionGithub[taskId]?.detailFetchedAt ?? null,
          detailLoading: state.sessionGithub[taskId]?.detailLoading ?? false,
          detailError: state.sessionGithub[taskId]?.detailError ?? null,
        },
      },
    }));
    try {
      const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath);
      if (!slug) {
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [taskId]: {
              pr: null,
              linkedIssues: [],
              fetchedAt: new Date().toISOString() as IsoDateTime,
              loading: false,
              error: null,
              detail: null,
              detailFetchedAt: null,
              detailLoading: false,
              detailError: null,
            },
          },
        }));
        return;
      }
      const store = createTauriPrCacheStore(tauriDatabase);
      const pr = await getPrForBranch(
        { runner: tauriGhRunner, store },
        { repoSlug: slug, branch, cwd: workspace.rootPath, force: opts?.force === true },
      );
      const linked = pr
        ? await fetchLinkedIssues(tauriGhRunner, slug, pr, { cwd: workspace.rootPath })
        : [];
      set((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [taskId]: {
            pr,
            linkedIssues: linked,
            fetchedAt: new Date().toISOString() as IsoDateTime,
            loading: false,
            error: null,
            detail: state.sessionGithub[taskId]?.detail ?? null,
            detailFetchedAt: state.sessionGithub[taskId]?.detailFetchedAt ?? null,
            detailLoading: state.sessionGithub[taskId]?.detailLoading ?? false,
            detailError: state.sessionGithub[taskId]?.detailError ?? null,
          },
        },
      }));
    } catch (err) {
      set((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [taskId]: {
            pr: state.sessionGithub[taskId]?.pr ?? null,
            linkedIssues: state.sessionGithub[taskId]?.linkedIssues ?? [],
            fetchedAt: state.sessionGithub[taskId]?.fetchedAt ?? null,
            loading: false,
            error: formatError(err),
            detail: state.sessionGithub[taskId]?.detail ?? null,
            detailFetchedAt: state.sessionGithub[taskId]?.detailFetchedAt ?? null,
            detailLoading: state.sessionGithub[taskId]?.detailLoading ?? false,
            detailError: state.sessionGithub[taskId]?.detailError ?? null,
          },
        },
      }));
    }
  },

  refreshSessionPrDetail: async (taskId, opts) => {
    const existing = get().sessionGithub[taskId];
    const pr = existing?.pr ?? null;
    if (!pr) return;
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) return;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) return;
    const fresh = existing?.detailFetchedAt
      ? Date.now() - new Date(existing.detailFetchedAt).getTime()
      : Number.POSITIVE_INFINITY;
    const DETAIL_TTL_MS = 30_000;
    if (!opts?.force && existing?.detail && fresh < DETAIL_TTL_MS) return;
    set((state) => ({
      sessionGithub: {
        ...state.sessionGithub,
        [taskId]: {
          pr: state.sessionGithub[taskId]?.pr ?? pr,
          linkedIssues: state.sessionGithub[taskId]?.linkedIssues ?? [],
          fetchedAt: state.sessionGithub[taskId]?.fetchedAt ?? null,
          loading: state.sessionGithub[taskId]?.loading ?? false,
          error: state.sessionGithub[taskId]?.error ?? null,
          detail: state.sessionGithub[taskId]?.detail ?? null,
          detailFetchedAt: state.sessionGithub[taskId]?.detailFetchedAt ?? null,
          detailLoading: true,
          detailError: null,
        },
      },
    }));
    try {
      const slug = await detectRepoSlug(tauriGhRunner, workspace.rootPath);
      if (!slug) {
        set((state) => ({
          sessionGithub: {
            ...state.sessionGithub,
            [taskId]: {
              pr: state.sessionGithub[taskId]?.pr ?? pr,
              linkedIssues: state.sessionGithub[taskId]?.linkedIssues ?? [],
              fetchedAt: state.sessionGithub[taskId]?.fetchedAt ?? null,
              loading: state.sessionGithub[taskId]?.loading ?? false,
              error: state.sessionGithub[taskId]?.error ?? null,
              detail: null,
              detailFetchedAt: new Date().toISOString() as IsoDateTime,
              detailLoading: false,
              detailError: null,
            },
          },
        }));
        return;
      }
      const detail = await fetchPrDetail(tauriGhRunner, slug, pr.number, {
        cwd: workspace.rootPath,
      });
      set((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [taskId]: {
            pr: state.sessionGithub[taskId]?.pr ?? pr,
            linkedIssues: state.sessionGithub[taskId]?.linkedIssues ?? [],
            fetchedAt: state.sessionGithub[taskId]?.fetchedAt ?? null,
            loading: state.sessionGithub[taskId]?.loading ?? false,
            error: state.sessionGithub[taskId]?.error ?? null,
            detail,
            detailFetchedAt: new Date().toISOString() as IsoDateTime,
            detailLoading: false,
            detailError: null,
          },
        },
      }));
    } catch (err) {
      set((state) => ({
        sessionGithub: {
          ...state.sessionGithub,
          [taskId]: {
            pr: state.sessionGithub[taskId]?.pr ?? pr,
            linkedIssues: state.sessionGithub[taskId]?.linkedIssues ?? [],
            fetchedAt: state.sessionGithub[taskId]?.fetchedAt ?? null,
            loading: state.sessionGithub[taskId]?.loading ?? false,
            error: state.sessionGithub[taskId]?.error ?? null,
            detail: state.sessionGithub[taskId]?.detail ?? null,
            detailFetchedAt: state.sessionGithub[taskId]?.detailFetchedAt ?? null,
            detailLoading: false,
            detailError: formatError(err),
          },
        },
      }));
    }
  },

  resolvePermissionRequest: async ({ taskId, agentId, toolUseId, toolName, runId, scope }) => {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) return;
    const now = new Date().toISOString() as IsoDateTime;

    if (scope === 'once') {
      set((state) => ({
        volatilePermissionAllows: new Set([...state.volatilePermissionAllows, toolUseId]),
      }));
    } else {
      const ruleDecision: PermissionDecisionKind = scope === 'deny' ? 'deny' : 'allow';
      const ruleScope = scope === 'deny' ? 'task' : scope;
      await invokePermissionRuleUpsert({
        scope: ruleScope,
        ...(ruleScope === 'workspace' ? { workspaceId: session.workspaceId } : {}),
        ...(ruleScope === 'task' ? { taskId } : {}),
        patternTool: toolName,
        decision: ruleDecision,
        priority: 100,
      });
    }

    get().appendTurnEvent(agentId, taskId, {
      kind: 'permission_decision',
      runId,
      toolUseId,
      decision: scope === 'deny' ? 'deny' : 'allow',
      ruleId: null,
      decidedBy: 'user',
      at: now,
    });
  },

  clearSessionNextActions: (taskId) => {
    set((state) => {
      if (state.sessionNextActions[taskId] === undefined) return {};
      const next = { ...state.sessionNextActions };
      delete next[taskId];
      return { sessionNextActions: next };
    });
  },

  setSessionPermissionMode: async (taskId, mode) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateTaskPermissionMode(tauriDatabase, taskId, mode, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === taskId ? { ...s, permissionMode: mode, updatedAt: now } : s,
      ),
    }));
  },

  setSessionAutoRun: async (taskId, autoRun) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateTaskAutoRun(tauriDatabase, taskId, autoRun, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === taskId ? { ...s, autoRun, updatedAt: now } : s,
      ),
    }));
    if (autoRun) void get().maybeAutoAdvanceWorkflow(taskId);
  },

  maybeAutoAdvanceWorkflow: async (taskId) => {
    const state = get();
    const task = state.sessions.find((s) => s.id === taskId);
    if (!task || !task.autoRun || !task.workflowId) return;
    const template = (state.phaseTemplates[task.workspaceId] ?? []).find(
      (t) => t.id === task.workflowId,
    );
    if (!template) return;
    const runs = state.sessionPhaseRuns[taskId] ?? [];
    if (runs.some((r) => r.status === 'failed')) return;
    const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
    const spawnedStepIds = new Set(
      runs.map((r) => r.stepId).filter((id): id is StepId => id !== undefined),
    );
    const next = sortedSteps.find((s) => !spawnedStepIds.has(s.id));
    if (!next) return;
    const prevSteps = sortedSteps.filter((s) => s.ordinal < next.ordinal);
    const prevAllCompleted = prevSteps.every((s) =>
      runs.some((r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped')),
    );
    if (!prevAllCompleted) return;
    const exceeded = state.budgetAlerts.some(
      (a) =>
        a.dismissedAt === undefined &&
        ((a.kind === 'task-exceeded' && a.taskId === taskId) || a.kind === 'provider-exceeded'),
    );
    if (exceeded) return;
    const kind = inferAgentKindFromName(next.name);
    const defaults = AGENT_KIND_DEFAULTS[kind];
    await get().spawnAgent(taskId, {
      name: next.name,
      stepId: next.id,
      model: next.modelOverride ?? defaults.model,
      effort: next.effort ?? defaults.effort,
    });
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `agent auto-spawned: ${next.name}`,
      undefined,
      { sessionId: taskId },
    );
  },

  createPrForSession: async (taskId) => {
    const branch = get().sessionBranches[taskId];
    const session = get().sessions.find((s) => s.id === taskId);
    if (!branch || !session) return;
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (!workspace) return;
    const res = await tauriGhRunner.run(['pr', 'create', '--fill', '--draft'], {
      cwd: workspace.rootPath,
    });
    if (res.exitCode !== 0) {
      const errMsg = res.stderr.trim() || `gh pr create exited with ${res.exitCode}`;
      void get().emitNotification('error', 'error', 'PR creation failed', errMsg, {
        sessionId: taskId,
        workspaceId: workspace.id,
      });
      throw new Error(errMsg);
    }
    await get().refreshSessionPr(taskId, { force: true });
    void get().emitNotification(
      'pr-created',
      'success',
      `PR created for: ${session.goal}`,
      undefined,
      { sessionId: taskId, workspaceId: workspace.id },
    );
  },
}));

export function useResolvedSettings(taskId: TaskId | null): ResolvedSettings {
  return useAppStore((state) => {
    const session = taskId ? (state.sessions.find((s) => s.id === taskId) ?? null) : null;
    const workspaceId = session?.workspaceId ?? null;

    const globalSettings: GlobalSettings = {
      defaultProviderId: DEFAULT_TASK_PROVIDER_PREFERENCE.defaultProvider,
      defaultWorkflowId: null,
      defaultBranchPrefix: DEFAULT_BRANCH_PREFIX,
      parallelEnabled:
        state.settings[SETTING_ENABLE_PARALLEL_AGENTS] === 'true' || DEFAULT_ENABLE_PARALLEL_AGENTS,
    };

    const workspaceOverride = workspaceId ? (state.workspaceOverrides[workspaceId] ?? null) : null;
    const sessionOverride = taskId ? (state.sessionOverrides[taskId] ?? null) : null;

    return resolveSettings({ global: globalSettings, workspaceOverride, sessionOverride });
  });
}
