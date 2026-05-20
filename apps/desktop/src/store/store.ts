import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  WorkflowPropagator,
  PermissionEngine,
  buildClaudeFlags,
  autoPopulateContext,
  buildStepPrompt,
  findReusableAgent,
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
  insertSession,
  insertSessionWorktree,
  insertTelemetry,
  insertTurnEvent,
  insertWorkspace,
  disconnectWorkspace as disconnectWorkspaceInDb,
  reconnectWorkspace as reconnectWorkspaceInDb,
  findWorkspaceByRootPath,
  listContextSlotsForSession,
  insertContextSlotHistory,
  listContextSlotHistory,
  listMessagesForAgent,
  listMessagesForSession,
  listTurnEventsForAgent,
  listTurnEventsForSession,
  listAgentRunIdsForSession,
  listSessionsForWorkspace,
  listTelemetryForSession,
  listWorkspaces,
  listWorktreesForSession,
  deleteWorktreesForSession,
  updateSessionWorktreeBranch,
  listAllSessionWorktrees,
  renameSession as renameSessionInDb,
  deleteSession as deleteSessionFromDb,
  setSetting as dbSetSetting,
  summarizeSessionTelemetry,
  summarizeWorkspaceTelemetry,
  summarizeWorkspaceProviderTelemetry,
  updateProviderRunStatus,
  updateSessionPermissionMode,
  updateSessionAutoRun,
  updateSessionWorkflow,
  updateSessionTitleUserEdited,
  updateSessionUserStatus,
  updateSessionState,
  listWorkspaceScripts,
  upsertWorkspaceScript,
  deleteWorkspaceScript,
  upsertContextSlot,
  type Notification,
  type NotificationKind,
  type NotificationSeverity,
  type TelemetrySummary,
} from '@kay-am/db';
import type {
  Agent,
  AgentId,
  AgentStatus,
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
  ParallelAgent,
  ParallelAgentId,
  PermissionDecision,
  PermissionDecisionKind,
  PermissionRequest,
  PermissionRequestId,
  PermissionRule,
  PlanConsumption,
  PlanId,
  PlanStatus,
  PlanWithCount,
  Step,
  StepId,
  Session,
  SessionId,
  SessionUserStatus,
  SessionBudget,
  SessionProviderPreference,
  Workflow,
  WorkflowId,
  ProviderId,
  ProviderRun,
  ProviderRunId,
  ResolvedSettings,
  TurnState,
  Skill,
  SkillId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  TurnProviderOverride,
  Workspace,
  WorkspaceId,
  WorkspaceScript,
  WorkspaceScriptId,
  GhTokenStatus,
  PullRequestState,
  LinkedIssue,
  PrDetail,
} from '@kay-am/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@kay-am/types';
import {
  computeCostUsd,
  computeCodexCostUsd,
  computeCursorCostUsd,
  extractPlanFromMarker,
} from '@kay-am/core';
import { runDbMigrations, tauriDatabase, wipeDb } from '../shared/lib/db';
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
} from '../features/providers/providers';
import { detectEditors, type DetectedEditor } from '../shared/lib/editor';
import { validateGitRepo } from '../shared/lib/repo';
import { resolveProviderForTurn } from '../features/providers/routing';
import {
  SETTING_EDITOR_BINARY,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
  DEFAULT_BRANCH_PREFIX,
} from '../features/settings/settings';
import { AGENT_FEATURES, MAX_WORKSPACES } from '../shared/lib/features';
import { getCodexPriceOverride, refreshPricingTable } from '../features/providers/provider-pricing';
import {
  runTurn,
  cancelTurn,
  encodeAuthRequiredMessage,
  isAuthErrorMessage,
} from '../features/chat/turn';
import { readVerbosity, verbosityDirective } from '../features/settings/verbosity';
import {
  createWorktree,
  removeWorktree,
  changeWorktreeBranch,
  type CreatedWorktree,
} from '../features/worktree/worktree';
import { invokeBudgetRuleList, invokeBudgetAlertsList } from '../features/budget/budget';
import {
  invokeSkillList,
  invokeSkillRescan,
  resolveSkillInvocation,
  type SkillUpsertArgs,
} from '../features/skills/skills';
import { invokeScriptRun, type ScriptRunResult } from '../features/scripts/scripts';
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
} from '../features/permissions/permissions';
import {
  invokePhaseTemplateList,
  invokePhaseTemplateUpsert,
  invokePhaseTemplateDelete,
  invokePhaseRunList,
  invokePhaseRunInsert,
  invokePhaseRunUpdateStatus,
  invokeSessionSetProviderSessionId,
  invokeSessionMarkViewed,
  invokeAgentSetKind,
  type PhaseTemplateUpsertArgs,
} from '../features/phases/phases';
import {
  detectParallelGroup,
  runParallelBranch,
  type ParallelBranchEffects,
} from './parallel-turn';
import { exportConfigToFile, importConfigFromFile } from '../features/settings/config-export';
import { formatError } from '../shared/lib/errors';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind,
} from '../features/session/agent-kind';
import { detectDrift } from '../features/session/drift-detection';
import {
  addPlanConsumption as invokeAddPlanConsumption,
  listConsumptionsForPlan as invokeListConsumptionsForPlan,
  listPlansForSession as invokeListPlansForSession,
  upsertPlan as invokeUpsertPlan,
} from '../features/plans/plans';
import { slotsForKind } from '../features/providers/slot-routing';
import { estimateTokens } from '../shared/utils/estimate-tokens';
import { createNotificationsSlice } from './slices/notifications.slice';
import { createPlansSlice } from './slices/plans.slice';
import { createBudgetSlice, buildProviderSpendBreakdown } from './slices/budget.slice';
import { createSkillsSlice } from './slices/skills.slice';
import { createDiffCommentsSlice } from './slices/diff-comments.slice';
import { createGithubSlice } from './slices/github.slice';
import { createSidebarSlice } from './slices/sidebar.slice';

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
import type { ProviderSpendEntry } from './slices/budget.slice';
export type { ProviderSpendEntry };

function toRelPath(absPath: string, workingDir: string): string {
  if (!workingDir) return absPath;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  return absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
}

export interface AppState {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Session>;
  readonly currentSessionId: SessionId | null;
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
  readonly sessionNextActions: Readonly<Record<SessionId, ReadonlyArray<NextAction>>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly systemAlerts: ReadonlyArray<SystemAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly workspaceScripts: Readonly<Record<WorkspaceId, ReadonlyArray<WorkspaceScript>>>;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>;
  readonly selectedAgentId: Readonly<Record<SessionId, AgentId | null>>;
  /**
   * Runtime history of providerRunIds per agent (Agent). Populated as turns
   * fire so the sidebar can aggregate telemetry across provider switches —
   * agents whose `runId` only points at the *latest* provider run would
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
  /**
   * Per-session loading flags. Each block (agents, transcript, telemetry,
   * slots, plans, summary) starts true on session switch and is flipped off
   * as that block's async load resolves. UI uses these to render skeletons
   * without blocking the whole app on a single Promise.all.
   */
  readonly sessionLoading: Readonly<Record<SessionId, SessionLoadingFlags>>;
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

export interface AppActions {
  hydrate(): Promise<void>;
  setCurrentWorkspace(id: WorkspaceId | null): Promise<void>;
  setCurrentSession(id: SessionId | null): Promise<void>;
  refreshSessions(workspaceId: WorkspaceId): Promise<void>;
  refreshSessionSummary(sessionId: SessionId): Promise<void>;
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
    providerPreference?: SessionProviderPreference;
    workflowId?: WorkflowId;
    autoRun?: boolean;
    firstAgentKind?: AgentKind;
    firstAgentModel?: string;
  }): Promise<{ session: Session; worktree: CreatedWorktree }>;
  changeSessionBranch(
    sessionId: SessionId,
    args: { branch: string; createNew: boolean },
  ): Promise<void>;
  setSessionAutoRun(sessionId: SessionId, autoRun: boolean): Promise<void>;
  attachWorkflowToSession(
    sessionId: SessionId,
    workflowId: WorkflowId,
    options?: { autoRun?: boolean },
  ): Promise<void>;
  setSessionUserStatus(sessionId: SessionId, status: SessionUserStatus): Promise<void>;
  activateWorkflowAgent(sessionId: SessionId, agentId: AgentId): Promise<void>;
  maybeAutoAdvanceWorkflow(sessionId: SessionId): Promise<void>;
  loadTranscript(agentId: AgentId, sessionId: SessionId): Promise<void>;
  appendTurnEvent(agentId: AgentId, sessionId: SessionId, event: TurnEvent): void;
  resetTranscript(agentId: AgentId): void;
  sendTurn(input: {
    sessionId: SessionId;
    agentId?: AgentId;
    content: string;
    override?: TurnProviderOverride;
    onNewAlerts?: (alerts: ReadonlyArray<BudgetAlert>) => void;
  }): Promise<void>;
  cancelCurrentTurn(sessionId: SessionId): Promise<void>;
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
  runScript(scriptId: WorkspaceScriptId): Promise<ScriptRunResult>;
  loadPhaseTemplates(workspaceId: WorkspaceId): Promise<void>;
  savePhaseTemplate(template: PhaseTemplateUpsertArgs): Promise<void>;
  deleteWorkflow(id: WorkflowId, workspaceId: WorkspaceId): Promise<void>;
  loadPhaseRunsForSession(sessionId: SessionId): Promise<void>;
  selectAgent(sessionId: SessionId, agentId: AgentId): Promise<void>;
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
  loadSessionOverrides(sessionId: SessionId): Promise<void>;
  setTaskOverrides(sessionId: SessionId, overrides: OverrideSettings): Promise<void>;
  renameTask(sessionId: SessionId, goal: string): Promise<void>;
  autoTitleSession(sessionId: SessionId, title: string): Promise<void>;
  deleteTask(sessionId: SessionId): Promise<void>;
  setSidebarWorkspaceSearch(query: string): void;
  setSidebarSessionSearch(query: string): void;
  refreshUnreadWorkspaces(): Promise<void>;
  setSidebarStateFilter(states: ReadonlyArray<TurnState['kind']>): void;
  setSidebarProviderFilter(providers: ReadonlyArray<ProviderId>): void;
  exportConfig(): Promise<string | null>;
  importConfig(): Promise<import('@kay-am/types').ConfigBundleImportResult | null>;
  refreshGithubStatus(): Promise<void>;
  setGithubPat(token: string): Promise<GhTokenStatus>;
  clearGithubToken(): Promise<void>;
  refreshSessionPr(sessionId: SessionId, opts?: { force?: boolean }): Promise<void>;
  refreshSessionPrDetail(sessionId: SessionId, opts?: { force?: boolean }): Promise<void>;
  createPrForSession(sessionId: SessionId): Promise<void>;
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
    anchor?: import('@kay-am/types').DiffCommentAnchor,
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
  abandonPlan(sessionId: SessionId, planId: PlanId): Promise<void>;
  loadConsumptionsForPlan(planId: PlanId): Promise<void>;
  runPlan(sessionId: SessionId, planId: PlanId): Promise<void>;
}

export type AppStore = AppState & AppActions;

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
  workspaceScripts: {},
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
  unreadWorkspaceIds: new Set<WorkspaceId>(),
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
  planConsumptions: {},
  sessionLoading: {},
};

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

export const summarizerQueues = new Map<SessionId, SummarizerTaskQueue>();

// Run IDs cancelled by the user via cancelCurrentTurn. The stream-end
// finalization in sendTurn checks this set and skips marking the agent as
// `completed` — a cancelled turn must NOT count as a workflow step
// completion, otherwise the next-step CTA appears prematurely.
const cancelledRunIds = new Set<ProviderRunId>();

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
  sessionId: SessionId,
  turnInput: string,
  turnOutput: string,
): void {
  let queue = summarizerQueues.get(sessionId);
  if (!queue) {
    queue = { inFlight: false, queued: null };
    summarizerQueues.set(sessionId, queue);
  }

  if (queue.inFlight) {
    // Coalesce: overwrite any previously queued entry with the latest.
    queue.queued = { turnInput, turnOutput };
    return;
  }

  queue.inFlight = true;
  queue.queued = null;

  const run = (): void => {
    void runSummarizer(set, get, sessionId, turnInput, turnOutput).finally(() => {
      const q = summarizerQueues.get(sessionId);
      if (!q) return;
      const next = q.queued;
      if (next) {
        q.queued = null;
        scheduleIdle(() => {
          void runSummarizer(set, get, sessionId, next.turnInput, next.turnOutput).finally(() => {
            const q2 = summarizerQueues.get(sessionId);
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
  sessionId: SessionId,
  state: TurnState,
  agentId?: AgentId,
): void {
  set((store) => ({
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, state, updatedAt: new Date().toISOString() as IsoDateTime } : s,
    ),
    ...(agentId !== undefined && {
      agentTurnState: { ...store.agentTurnState, [agentId]: state },
    }),
  }));
}

async function runSummarizer(
  set: SetFn,
  get: () => AppStore,
  sessionId: SessionId,
  turnInput: string,
  turnOutput: string,
): Promise<void> {
  const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

  // Mark running without a separate set — merged into the final batch below on success,
  // or emitted immediately only on the error path. This avoids a spurious re-render at start.
  set((state) => {
    const prev = state.summarizerStatus[sessionId];
    return {
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: {
          status: 'running',
          lastUpdate: prev?.lastUpdate ?? null,
          error: null,
          lastUsage: prev?.lastUsage ?? null,
        },
      },
    };
  });

  try {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const providerId = session.providerPreference.defaultProvider;
    const summarizer = new Summarizer({ providerId, invokeFn: invoke });
    const prevSlots = get().sessionSlots[sessionId] ?? [];
    const ghPr = get().sessionGithub[sessionId]?.pr ?? null;
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
        const existing = (get().sessionSlots[sessionId] ?? []).find((s) => s.key === upsert.key);
        if (existing && existing.value !== upsert.value) {
          await insertContextSlotHistory(
            tauriDatabase,
            sessionId,
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
        await upsertContextSlot(tauriDatabase, sessionId, next);
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
      listContextSlotsForSession(tauriDatabase, sessionId),
      insertProviderRun(tauriDatabase, {
        id: summarizerRunId,
        sessionId,
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
            sessionId,
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
      summarizeSessionTelemetry(tauriDatabase, sessionId),
      summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
      listTelemetryForSession(tauriDatabase, sessionId),
      summarizeWorkspaceProviderTelemetry(tauriDatabase, session.workspaceId),
      invokeBudgetRuleList(),
    ]);

    // Single batched set — one re-render for the entire summarizer completion.
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: refreshed },
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: telemetry },
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: {
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
      sessionNextActions: { ...state.sessionNextActions, [sessionId]: result.nextActions },
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    }));
    void get().emitNotification('summarizer-success', 'info', 'context summarized', undefined, {
      sessionId,
    });
  } catch (err) {
    // never log api key — only the error message
    const message = formatError(err);
    if (import.meta.env.DEV) {
      console.warn(`[summarizer] failed for session ${sessionId}: ${message}`);
    }
    set((state) => {
      const prev = state.summarizerStatus[sessionId];
      return {
        summarizerStatus: {
          ...state.summarizerStatus,
          [sessionId]: {
            status: 'error',
            lastUpdate: now(),
            error: message,
            lastUsage: prev?.lastUsage ?? null,
          },
        },
      };
    });
    void get().emitNotification('error', 'error', 'summarizer failed', message, {
      sessionId,
    });
  }
}

async function buildPlanKickoffSection(
  sessionId: SessionId,
): Promise<{ section: string; plan: PlanWithCount | null }> {
  try {
    const plans = await invokeListPlansForSession(sessionId);
    const latest = plans[plans.length - 1] ?? null;
    if (!latest || latest.status !== 'active') return { section: '', plan: latest };
    return {
      section: ['Active plan to execute:', '', latest.bodyMd].join('\n'),
      plan: latest,
    };
  } catch {
    return { section: '', plan: null };
  }
}

function composeKickoff(planSection: string, baseKickoff: string): string {
  if (planSection.length === 0) return baseKickoff;
  if (baseKickoff.length === 0) return planSection;
  return `${planSection}\n\n${baseKickoff}`;
}

async function capturePlanFromTurn(
  set: SetFn,
  sessionId: SessionId,
  agentId: AgentId,
  assistantText: string,
): Promise<void> {
  try {
    const extracted = extractPlanFromMarker(assistantText);
    if (!extracted) return;
    await invokeUpsertPlan({
      sessionId,
      agentId,
      title: extracted.title,
      bodyMd: extracted.bodyMd,
    });
    const refreshed = await invokeListPlansForSession(sessionId);
    set((state) => ({
      sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
    }));
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[plan-capture] failed for session ${sessionId}: ${formatError(err)}`);
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
  sessionId: SessionId,
  turnInput: string,
  turnOutput: string,
  agentId: AgentId | null,
): Promise<void> {
  try {
    const session = get().sessions.find((s) => s.id === sessionId);
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
    const result = await invoke<SummarizeCommandResult>('summarize_session', {
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
        sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, goal: title } : s)),
      }));
      await renameSessionInDb(tauriDatabase, sessionId, title, titleNow, false);
    }
    if (agentId) {
      if (!get().agentKindOverride[agentId]) {
        const runs = get().sessionPhaseRuns[sessionId] ?? [];
        const row = runs.find((r) => r.id === agentId);
        const currentKind = inferAgentKindFromName(row?.name ?? '');
        set((s) => ({
          agentKindOverride: { ...s.agentKindOverride, [agentId]: currentKind },
        }));
        void invokeAgentSetKind(agentId, currentKind).catch(() => {
          // Best-effort persistence; not fatal if it fails.
        });
      }
      await get().renameAgent(sessionId, agentId, title);
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
  ...createNotificationsSlice(set, get),
  ...createPlansSlice(set, get),
  ...createBudgetSlice(set, get),
  ...createSkillsSlice(set, get),
  ...createDiffCommentsSlice(set, get),
  ...createGithubSlice(set, get),
  ...createSidebarSlice(set, get),

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
            lastSessionRaw && lastSessionRaw.length > 0 ? (lastSessionRaw as SessionId) : null;
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
        listSessionsForWorkspace(tauriDatabase, id),
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
          await updateSessionState(tauriDatabase, s.id, idleState, recoveryNow).catch(
            () => undefined,
          );
          return { ...s, state: idleState, updatedAt: recoveryNow };
        }),
      );
      const [worktreeRows, phaseRunsPerTask] = await Promise.all([
        Promise.all(sessions.map((s) => listWorktreesForSession(tauriDatabase, s.id))),
        // Eager-load agents (phase runs) for every session in this workspace. The
        // unread indicators on workspace- and session-rows derive from each
        // agent's `lastFinishedAt` vs `lastViewedAt` columns, and those are
        // only inspected once we have the agent rows in memory. Without this
        // prefetch, the sidebar would only know about agents for sessions the
        // user has explicitly opened — yellow dots vanish on workspace switch.
        Promise.all(sessions.map((s) => invokePhaseRunList(s.id))),
      ]);
      const sessionWorktrees: Record<string, ReadonlyArray<string>> = {};
      const sessionBranches: Record<string, string> = {};
      const sessionPhaseRuns: Record<string, ReadonlyArray<Agent>> = {};
      const kindOverridesFromDb: Record<string, AgentKind> = {};
      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i]!;
        const rows = worktreeRows[i]!;
        if (rows.length > 0) {
          sessionWorktrees[s.id] = rows.map((r) => r.worktreePath);
          const primaryRow = rows[0];
          if (primaryRow) sessionBranches[s.id] = primaryRow.branch;
        }
        const runs = phaseRunsPerTask[i]!;
        sessionPhaseRuns[s.id] = runs;
        for (const run of runs) {
          if (run.kind) kindOverridesFromDb[run.id] = run.kind as AgentKind;
        }
      }
      set((state) => ({
        sessions,
        sessionWorktrees,
        sessionBranches,
        sessionPhaseRuns,
        workspaceSummary,
        providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
        skills: { ...state.skills, [id]: skills },
        phaseTemplates: { ...state.phaseTemplates, [id]: phaseTemplates },
        agentKindOverride: { ...state.agentKindOverride, ...kindOverridesFromDb },
      }));
    } else {
      set({ providerSpendBreakdown: [] });
    }
    await dbSetSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID, id ?? '');
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
    void get().refreshUnreadWorkspaces();
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
    void summarizeSessionTelemetry(tauriDatabase, id)
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
      void listTelemetryForSession(tauriDatabase, id)
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
      void listContextSlotsForSession(tauriDatabase, id)
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
      void (async (): Promise<ReadonlyArray<PlanWithCount>> => {
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
        listAgentRunIdsForSession(tauriDatabase, id).finally(() => endRunIds()),
      ])
        .then(([agents, agentRunIds]) => {
          const previouslySelected = get().selectedAgentId[id] ?? null;
          const sortedAgents = [...agents].sort((a, b) => a.ordinal - b.ordinal);
          // Fresh entry defaults to the most recently created agent (highest
          // ordinal). Chronologically the latest is the one the user is most
          // likely returning to. Previous selection still wins on revisit.
          const fallbackAgent = sortedAgents[sortedAgents.length - 1] ?? null;
          const selectedAgent =
            (previouslySelected && agents.find((a) => a.id === previouslySelected)) ||
            fallbackAgent;

          // Seed agentRunHistory with EVERY provider run an agent ever spawned,
          // not just its latest. Recovered from turn_events (single source of
          // truth post restart) so aggregate token/cost counters in the sidebar
          // reflect the full agent lifetime — birth to death — instead of the
          // last turn.
          const seededHistory: Record<string, ReadonlyArray<ProviderRunId>> = {};
          const seededTurnState: Record<string, TurnState> = {};
          const session = get().sessions.find((s) => s.id === id);
          const sessionState =
            session?.state ??
            ({ kind: 'idle', lastActivityAt: new Date().toISOString() } as TurnState);
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
                sessionState.kind === 'ended'
                  ? sessionState
                  : { kind: 'idle', lastActivityAt: new Date().toISOString() as IsoDateTime };
            }
          }

          const kindOverridesFromDb: Record<string, AgentKind> = {};
          for (const agent of agents) {
            if (agent.kind) kindOverridesFromDb[agent.id] = agent.kind as AgentKind;
          }
          set((state) => ({
            sessionPhaseRuns: { ...state.sessionPhaseRuns, [id]: agents },
            selectedAgentId: {
              ...state.selectedAgentId,
              [id]: selectedAgent?.id ?? null,
            },
            agentRunHistory: { ...state.agentRunHistory, ...seededHistory },
            agentTurnState: { ...state.agentTurnState, ...seededTurnState },
            agentKindOverride: { ...state.agentKindOverride, ...kindOverridesFromDb },
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
    const sessions = await listSessionsForWorkspace(tauriDatabase, workspaceId);
    set({ sessions });
  },

  refreshSessionSummary: async (sessionId) => {
    const summary = await summarizeSessionTelemetry(tauriDatabase, sessionId);
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
    firstAgentKind,
    firstAgentModel: requestedModel,
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
    const session: Session = {
      id: crypto.randomUUID() as SessionId,
      workspaceId,
      goal: goal.trim() || worktree.slug,
      state: initialState,
      contextSlots: [],
      providerPreference: providerPreference ?? DEFAULT_SESSION_PROVIDER_PREFERENCE,
      permissionMode: 'bypassPermissions',
      ...(workflowId !== undefined ? { workflowId } : {}),
      autoRun: autoRun === true && workflowId !== undefined,
      titleUserEdited: false,
      userStatus: 'wip',
      createdAt: now,
      updatedAt: now,
    };
    await insertSession(tauriDatabase, session);
    await insertSessionWorktree(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId: session.id,
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

    // Pre-create all workflow agents so the sidebar shows the full plan as a
    // progress tracker. Only the first step fires sendTurn; the rest stay
    // pending until the user (or autoRun) advances. Ad-hoc agents spawned
    // later appear in a separate "Agents" block below the workflow block.
    let prespawnedRuns: ReadonlyArray<Agent>;
    let firstStepPromptPrefix = '';
    const agentModelOverrides: Record<string, string> = {};
    const agentKindOverrides: Record<string, string> = {};

    if (workflowId) {
      const templates = get().phaseTemplates[workspaceId] ?? [];
      const template = templates.find((t) => t.id === workflowId) ?? null;
      const sortedSteps = template ? [...template.steps].sort((a, b) => a.ordinal - b.ordinal) : [];

      if (sortedSteps.length > 0) {
        const allAgents: Agent[] = [];
        for (const step of sortedSteps) {
          const kind = inferAgentKindFromName(step.name);
          const agent = await invokePhaseRunInsert({
            sessionId: session.id,
            stepId: step.id,
            ordinal: step.ordinal,
            name: step.name,
            status: 'pending',
            kind,
          });
          agentModelOverrides[agent.id] = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
          agentKindOverrides[agent.id] = kind;
          allAgents.push(agent);
        }
        firstStepPromptPrefix = sortedSteps[0]!.promptPrefix;
        prespawnedRuns = allAgents;
      } else {
        const fallback = await invokePhaseRunInsert({
          sessionId: session.id,
          ordinal: 0,
          name: 'agent 1',
          status: 'pending',
        });
        prespawnedRuns = [fallback];
      }
    } else if (firstAgentKind !== undefined) {
      const agentName = AGENT_KIND_META[firstAgentKind].label.toLowerCase();
      const model = requestedModel ?? AGENT_KIND_DEFAULTS[firstAgentKind].model;
      const singleAgent = await invokePhaseRunInsert({
        sessionId: session.id,
        ordinal: 0,
        name: agentName,
        status: 'pending',
        kind: firstAgentKind,
      });
      if (model !== null) agentModelOverrides[singleAgent.id] = model;
      agentKindOverrides[singleAgent.id] = firstAgentKind;
      prespawnedRuns = [singleAgent];
    } else {
      prespawnedRuns = [];
    }

    const firstAgent = prespawnedRuns[0] ?? null;
    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of prespawnedRuns) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

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
      selectedAgentId: firstAgent
        ? { ...state.selectedAgentId, [session.id]: firstAgent.id }
        : state.selectedAgentId,
      transcripts: { ...state.transcripts, ...transcriptEntries },
      messages: { ...state.messages, [session.id]: [] },
      agentTurnState: { ...state.agentTurnState, ...turnStateEntries },
      agentModelOverride: { ...get().agentModelOverride, ...agentModelOverrides },
      agentKindOverride: { ...get().agentKindOverride, ...agentKindOverrides },
    }));
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, session.id);

    if (firstStepPromptPrefix.length > 0) {
      void get().sendTurn({ sessionId: session.id, content: firstStepPromptPrefix });
    } else if (firstAgentKind && firstAgentKind !== 'generic' && goalText.length > 0) {
      void get().sendTurn({ sessionId: session.id, content: goalText });
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

  changeSessionBranch: async (sessionId, { branch, createNew }) => {
    const target = branch.trim();
    if (!target) throw new Error('branch name cannot be empty');
    const worktrees = await listWorktreesForSession(tauriDatabase, sessionId);
    const primary = worktrees[0];
    if (!primary) throw new Error(`no worktree found for session ${sessionId}`);
    const session = get().sessions.find((s) => s.id === sessionId);
    const workspace = session ? get().workspaces.find((w) => w.id === session.workspaceId) : null;
    if (!workspace) throw new Error('workspace not found for session');
    await changeWorktreeBranch({
      repoPath: workspace.rootPath,
      worktreePath: primary.worktreePath,
      branch: target,
      createNew,
    });
    await updateSessionWorktreeBranch(tauriDatabase, sessionId, primary.parallelIndex, target);
    set((state) => ({
      sessionBranches: { ...state.sessionBranches, [sessionId]: target },
    }));
  },

  loadTranscript: async (agentId, sessionId) => {
    const [messages, events] = await Promise.all([
      listMessagesForAgent(tauriDatabase, agentId),
      listTurnEventsForAgent(tauriDatabase, agentId),
    ]);
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
      transcripts: { ...state.transcripts, [agentId]: events },
    }));
  },

  appendTurnEvent: (agentId, sessionId, event) => {
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
        const runs = state.sessionPhaseRuns[sessionId] ?? [];
        const updatedRuns = runs.map((s) =>
          s.id === agentId ? { ...s, providerSessionId: event.providerSessionId } : s,
        );
        void insertTurnEvent(tauriDatabase, {
          id: crypto.randomUUID(),
          sessionId,
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
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: updatedRuns },
        };
      }
      return { transcripts: updatedTranscripts };
    });
    if (event.kind === 'provider_session_init') return;
    void insertTurnEvent(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId,
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

  sendTurn: async ({ sessionId, agentId, content, override, onNewAlerts }) => {
    const before = get();
    const session = before.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    const workingDir = (before.sessionWorktrees[sessionId] ?? [])[0] ?? null;
    if (!workingDir) {
      throw new Error(
        'session worktree not initialized. restart the app to reload persisted worktree paths',
      );
    }

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;

    const activeAgentId = agentId ?? before.selectedAgentId[sessionId] ?? null;
    if (!activeAgentId) {
      throw new Error('no agent selected. spawn one before sending a turn');
    }

    const userTurnText = content;
    let resolvedPrompt = content;

    const slashCmd = parseSlashCommand(content);
    if (slashCmd !== null) {
      const workspaceSkills = before.skills[session.workspaceId] ?? [];
      const skill = workspaceSkills.find((s) => s.name === slashCmd.name);
      if (!skill) {
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, sessionId, {
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
        get().appendTurnEvent(activeAgentId, sessionId, {
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
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'skill_invocation',
          runId: skillRunId,
          skillName: result.skillName,
          args: result.args,
          at: now(),
        });
      } catch (err) {
        const message = formatError(err);
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(activeAgentId, sessionId, {
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
        const freshRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: freshRuns },
        }));
        // Route the turn to the step of the currently selected agent. With
        // pre-creation, selectedAgentId is the source of truth: it's set by
        // activateWorkflowAgent (auto-advance / CTA) or spawnAgent (retry),
        // or the user via the sidebar. Falling back to currentStep here
        // would mis-route follow-up turns to the next pre-created pending
        // step instead of staying on the active agent.
        const initialRuns = before.sessionPhaseRuns[sessionId] ?? [];
        const activeAgentRow =
          freshRuns.find((r) => r.id === activeAgentId) ??
          initialRuns.find((r) => r.id === activeAgentId) ??
          null;
        const nextDef = activeAgentRow?.stepId
          ? (template.steps.find((s) => s.id === activeAgentRow.stepId) ?? null)
          : null;
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
          const isFirstTurnOfStep = !freshRuns.some(
            (r) => r.stepId === nextDef.id && r.status !== 'pending',
          );
          if (prevDef && prevRun && isFirstTurnOfStep) {
            const propagator = new WorkflowPropagator({
              summarizer: { summarizePhaseOutput: async (text) => text },
            });
            const transition = await propagator.buildTransition({
              fromOrdinal: prevDef.ordinal,
              toOrdinal: nextDef.ordinal,
              completedPhaseOutput: prevRun.outputSummary ?? '',
              existingSlots: get().sessionSlots[sessionId] ?? [],
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

          // Detect parallel group — only when feature flag is on AND nextDef
          // belongs to a group with >= 2 siblings. Defer prompt rebuild for parallel
          // path: per-def prompts are built inside runParallelBranch using
          // userPromptForPhase + phasePromptCarryForward.
          if (AGENT_FEATURES.parallelAgents) {
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
      get().appendTurnEvent(activeAgentId, sessionId, {
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
      get().appendTurnEvent(activeAgentId, sessionId, {
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
        sessionId,
        agentId: activeAgentId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
        ...(resolvedOverride !== undefined ? { providerOverride: resolvedOverride } : {}),
      };
      await insertMessage(tauriDatabase, userMessage);
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'user_text',
        runId,
        text: userTurnText,
        at: userMessage.createdAt,
      });

      const run: ProviderRun = {
        id: runId,
        sessionId,
        provider,
        model,
        status: { kind: 'streaming', startedAt: now() },
        routingDecision,
        createdAt: now(),
      };
      await insertProviderRun(tauriDatabase, run);
    }

    let resolvedAgentId: AgentId | null = null;
    if (phaseDefinition && parallelDispatch === null) {
      // Reuse the existing Agent row for this step if one already exists.
      // Agent-multi-turn: every turn flips the same row to running and points
      // it at the new providerRunId, instead of inserting a fresh row per
      // user message. New rows only appear when the user spawns a new agent.
      const runsForSession = get().sessionPhaseRuns[sessionId] ?? [];
      const reusable = findReusableAgent(runsForSession, phaseDefinition.id);
      let resolved: Agent;
      if (reusable) {
        resolved = await invokePhaseRunUpdateStatus(reusable.id, {
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
        });
      } else {
        resolved = await invokePhaseRunInsert({
          sessionId,
          stepId: phaseDefinition.id,
          ordinal: phaseDefinition.ordinal,
          name: phaseDefinition.name,
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
          kind: inferAgentKindFromName(phaseDefinition.name),
        });
      }
      resolvedAgentId = resolved.id;
      const refreshedRuns = await invokePhaseRunList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
      }));
      if (phaseTransitionEvent) {
        get().appendTurnEvent(activeAgentId, sessionId, { ...phaseTransitionEvent, runId });
      }
    } else if (!phaseDefinition && parallelDispatch === null) {
      const manualAgentId = get().selectedAgentId[sessionId] ?? null;
      if (manualAgentId) {
        await invokePhaseRunUpdateStatus(manualAgentId, {
          status: 'running',
          providerRunId: runId,
          startedAt: now(),
        });
        resolvedAgentId = manualAgentId;
        const refreshedRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
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
      await updateSessionState(tauriDatabase, sessionId, nextState, now());
      applySessionUpdate(set, sessionId, nextState, activeAgentId);
    }

    const providerInfo = get().providers.find((p) => p.id === provider);

    let claudeFlags: Partial<ClaudeFlagSet> = {};
    let effectiveRules: ReadonlyArray<PermissionRule> = [];
    if (provider === 'anthropic') {
      try {
        const [globalRules, workspaceRules, sessionRules] = await Promise.all([
          invokePermissionRuleList({ scope: 'global' }),
          invokePermissionRuleList({ scope: 'workspace', workspaceId: session.workspaceId }),
          invokePermissionRuleList({ scope: 'session', sessionId }),
        ]);
        effectiveRules = [...globalRules, ...workspaceRules, ...sessionRules];
        const flags = buildClaudeFlags({
          rules: effectiveRules,
          scope: { workspaceId: session.workspaceId, sessionId },
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
        get().appendTurnEvent(activeAgentId, sessionId, {
          kind: 'error',
          runId: crypto.randomUUID() as ProviderRunId,
          message: `workspace not found: ${session.workspaceId}`,
          at: now(),
        });
        return;
      }

      const N = Math.min(parallelDispatch.groupDefs.length, AGENT_FEATURES.maxParallelism);

      const sessBudget = get().sessionBudgets[sessionId];
      if (sessBudget) {
        const tele = get().sessionTelemetry[sessionId] ?? [];
        const lastTurnCost = tele.length > 0 ? (tele[tele.length - 1]?.estimatedCostUsd ?? 0) : 0;
        const projected = lastTurnCost * N;
        const sessSpent = (get().sessionSummary?.estimatedCostUsd ?? 0) + projected;
        if (lastTurnCost > 0 && sessSpent > sessBudget.softCapUsd) {
          get().appendTurnEvent(activeAgentId, sessionId, {
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
        sessionId,
        agentId: activeAgentId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, userMessage);

      const groupSessionRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(activeAgentId, sessionId, {
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
      await updateSessionState(tauriDatabase, sessionId, nextStateP, now());
      applySessionUpdate(set, sessionId, nextStateP, activeAgentId);

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
            maxParallelism: AGENT_FEATURES.maxParallelism,
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
          await updateSessionState(tauriDatabase, sessionId, errorState, now());
          applySessionUpdate(set, sessionId, errorState, activeAgentId);
        } else {
          await updateSessionState(
            tauriDatabase,
            sessionId,
            turnReducer(get().sessions.find((s) => s.id === sessionId)?.state ?? nextStateP, {
              kind: 'receive_event',
              event: { kind: 'done', runId: result.runIds[0]!, at: now() },
            }),
            now(),
          );
        }
      } catch (err) {
        const rawMessage = formatError(err);
        get().appendTurnEvent(activeAgentId, sessionId, {
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
        await updateSessionState(tauriDatabase, sessionId, errorState, now());
        applySessionUpdate(set, sessionId, errorState, activeAgentId);
        throw err;
      }
      return;
    }
    void refreshPricingTable();

    // ContextPanel acts as the Session's shared memory: prepend the serialized
    // slots + a marker hint so the agent (a) sees what previous agents in
    // this Session already learned, and (b) knows how to write back via
    // <<ctx-decision>> / <<ctx-question>> markers parsed in the auto-populate
    // step after the turn ends.
    // Stale slots are acceptable: do NOT await the summarizer here — doing so
    // blocks user input for up to 2s between turns (#461). The summarizer pill
    // already signals in-flight status; the next turn may use previous-cycle
    // slots and that tradeoff is explicitly accepted.
    const sharedSlots = get().sessionSlots[sessionId] ?? [];

    // M1: read the agent row once here; used by M5 (provider-id check) and M3 below.
    const agentRowEarly =
      (get().sessionPhaseRuns[sessionId] ?? []).find((s) => s.id === activeAgentId) ?? null;
    const earlyAgentKind =
      get().agentKindOverride[activeAgentId] ?? inferAgentKindFromName(agentRowEarly?.name ?? '');
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

    const verbosityHint = verbosityDirective(
      phaseDefinition?.verbosity ?? readVerbosity(sessionId),
    );
    resolvedPrompt = `${verbosityHint}\n\n${resolvedPrompt}`;

    // M4: soft-cap warning. heuristic only — exact tokenization requires wasm.
    const estimated = estimateTokens(resolvedPrompt);
    const ctxWindow = getModelContextWindow(model);
    if (ctxWindow !== null) {
      const ratio = estimated / ctxWindow;
      if (ratio >= 0.85) {
        const pct = Math.round(ratio * 100);
        const msg = `ctx estimate: ${estimated.toLocaleString()} / ${ctxWindow.toLocaleString()} (${pct}%). consider /compact`;
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
    let turnWasCancelled = false;
    const filesTouchedThisTurn = new Set<string>();

    // M1: thread the per-agent provider session id so claude `--resume`s and
    // keeps prior-turn context across one-shot CLI invocations.
    const resumeSessionId = agentRowEarly?.providerSessionId;

    // M3: per-kind system prompt — biases planner/implementer/debugger toward
    // their role. Only claude consumes it today; other providers ignore the
    // arg downstream.
    const kindSystemPrompt = AGENT_KIND_DEFAULTS[earlyAgentKind].systemPrompt;

    if (provider !== 'anthropic' && kindSystemPrompt) {
      resolvedPrompt = `[role-boundary]\n${kindSystemPrompt}\n[/role-boundary]\n\n${resolvedPrompt}`;
    }

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
        get().appendTurnEvent(activeAgentId, sessionId, event);
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
                sessionId,
                workspaceId: session.workspaceId,
              });
          const auditPayload: PermissionAuditInsertPayload = {
            id: auditRequestId,
            runId,
            sessionId,
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
            sessionId,
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
              [sessionId]: [...(state.sessionTelemetry[sessionId] ?? []), record],
            },
          }));
          const session = get().sessions.find((s) => s.id === sessionId);
          if (session) {
            const [sessSummary, wsSummary, providerSummaries, budgetRules, freshAlerts] =
              await Promise.all([
                summarizeSessionTelemetry(tauriDatabase, sessionId),
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

        const current = get().sessions.find((s) => s.id === sessionId);
        if (current) {
          const reduced = turnReducer(current.state, { kind: 'receive_event', event });
          if (reduced !== current.state) {
            await updateSessionState(tauriDatabase, sessionId, reduced, now());
            applySessionUpdate(set, sessionId, reduced, activeAgentId);
          }
        }
      }
      // Stream ended without a 'done'/'error' event — provider CLI exited
      // cleanly but didn't emit a `result` line, so the reducer never left
      // 'running'. Force-idle so input re-enables.
      const afterStream = get().sessions.find((s) => s.id === sessionId);
      if (afterStream?.state.kind === 'running') {
        const idleState: TurnState = { kind: 'idle', lastActivityAt: now() };
        await updateSessionState(tauriDatabase, sessionId, idleState, now());
        applySessionUpdate(set, sessionId, idleState, activeAgentId);
        if (assistantText.length === 0) {
          get().appendTurnEvent(activeAgentId, sessionId, {
            kind: 'error',
            runId,
            message:
              'provider exited without a response. check that the CLI is configured correctly.',
            at: now(),
          });
        }
      }
      const wasCancelled = cancelledRunIds.delete(runId);
      turnWasCancelled = wasCancelled;
      await updateProviderRunStatus(
        tauriDatabase,
        runId,
        wasCancelled
          ? { kind: 'failed', finishedAt: now(), error: 'cancelled by user' }
          : { kind: 'succeeded', finishedAt: now() },
      );
      if (resolvedAgentId && !wasCancelled) {
        await invokePhaseRunUpdateStatus(resolvedAgentId, {
          status: 'completed',
          outputSummary: assistantText.slice(0, 2000),
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
          ...(phaseDefinition && {
            sessions: state.sessions.map((s) =>
              s.id === sessionId ? { ...s, currentStepOrdinal: phaseDefinition.ordinal } : s,
            ),
          }),
        }));
        void get().refreshUnreadWorkspaces();

        void get().maybeAutoAdvanceWorkflow(sessionId);
      } else if (resolvedAgentId && wasCancelled) {
        // Cancelled turn — agent stays `running`. It was activated and has
        // context; reverting to `pending` would re-surface the "force spawn"
        // dialog. We only block workflow advancement (no auto-advance call).
        const refreshedRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
      }

      // Auto-populate ContextPanel from this turn's output: file paths come
      // from file_edit events; <<ctx-decision>> / <<ctx-question>> markers come
      // from the assistant text. Best-effort — slot writes failing must not
      // mask the turn itself.
      try {
        const result = await autoPopulateContext({
          db: tauriDatabase,
          sessionId,
          filesEdited: Array.from(filesTouchedThisTurn),
          assistantText,
        });
        if (result.updatedSlots.length > 0) {
          const refreshedSlots = await listContextSlotsForSession(tauriDatabase, sessionId);
          set((state) => ({
            sessionSlots: { ...state.sessionSlots, [sessionId]: refreshedSlots },
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
      await updateSessionState(tauriDatabase, sessionId, errorState, now());
      applySessionUpdate(set, sessionId, errorState, activeAgentId);
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: rawMessage,
      });
      get().appendTurnEvent(activeAgentId, sessionId, {
        kind: 'error',
        runId,
        message,
        at: now(),
      });
      if (resolvedAgentId) {
        await invokePhaseRunUpdateStatus(resolvedAgentId, {
          status: 'failed',
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
        void get().refreshUnreadWorkspaces();
      }
    }

    if (assistantText.length > 0) {
      const assistantMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        sessionId,
        agentId: activeAgentId,
        role: 'assistant',
        content: assistantText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, assistantMessage);
    }

    if (!lastError && !turnWasCancelled && assistantText.length > 0) {
      enqueueSummarizer(set, get, sessionId, resolvedPrompt, assistantText);
      void capturePlanFromTurn(set, sessionId, activeAgentId, assistantText);
      const driftViolations = detectDrift({
        agentKind: earlyAgentKind,
        assistantText,
        filesEdited: Array.from(filesTouchedThisTurn),
      });
      if (driftViolations.length > 0) {
        void get().emitNotification(
          'boundary-drift',
          'warning',
          `${agentRowEarly?.name ?? 'agent'} drifted from ${earlyAgentKind} role`,
          driftViolations[0]!.detail,
          { sessionId },
        );
      }
      if (
        !get().sessionGithub[sessionId]?.pr &&
        /github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/.test(assistantText)
      ) {
        void get()
          .refreshSessionPr(sessionId, { force: true })
          .then(() => void get().refreshSessionPrDetail(sessionId, { force: true }));
      }
      if (isFirstTurn) {
        const sessionForTitle = get().sessions.find((s) => s.id === sessionId);
        const titleEditable = sessionForTitle ? !sessionForTitle.titleUserEdited : false;
        // Only auto-rename agents whose name still matches the default
        // `agent N` pattern — workflow-step names and user edits stay.
        const agentRecord = (get().sessionPhaseRuns[sessionId] ?? []).find(
          (r) => r.id === activeAgentId,
        );
        const agentNameEditable = agentRecord ? /^agent \d+$/i.test(agentRecord.name) : false;
        if (sessionForTitle && (titleEditable || agentNameEditable)) {
          void generateAutoTitle(
            set,
            get,
            sessionId,
            resolvedPrompt,
            assistantText,
            agentNameEditable ? activeAgentId : null,
          );
        }
      }
    }

    if (lastError) throw lastError;
  },

  cancelCurrentTurn: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.state.kind !== 'running') return;
    const cancelAgentId = get().selectedAgentId[sessionId] ?? null;
    cancelledRunIds.add(session.state.runId);
    await cancelTurn(session.state.runId).catch(() => undefined);
    const now = new Date().toISOString() as IsoDateTime;
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    await updateSessionState(tauriDatabase, sessionId, idleState, now).catch(() => undefined);
    applySessionUpdate(set, sessionId, idleState, cancelAgentId ?? undefined);
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

  loadSessionTelemetry: async (sessionId) => {
    const records = await listTelemetryForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: records },
    }));
  },

  loadSessionSlots: async (sessionId) => {
    const slots = await listContextSlotsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: slots },
    }));
  },

  upsertSessionSlot: async (sessionId, key, value) => {
    const existing = get().sessionSlots[sessionId] ?? [];
    const prev = existing.find((s) => s.key === key);
    if (prev && prev.value !== value) {
      await insertContextSlotHistory(
        tauriDatabase,
        sessionId,
        crypto.randomUUID(),
        key,
        prev.value,
        'user',
      );
    }
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    await upsertContextSlot(tauriDatabase, sessionId, next);
    const refreshedHistory = await listContextSlotHistory(tauriDatabase, sessionId, key);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
      },
      slotHistory: {
        ...state.slotHistory,
        [sessionId]: {
          ...(state.slotHistory[sessionId] ?? {}),
          [key]: refreshedHistory,
        },
      },
    }));
  },

  loadSlotHistory: async (sessionId, key) => {
    const entries = await listContextSlotHistory(tauriDatabase, sessionId, key);
    set((state) => ({
      slotHistory: {
        ...state.slotHistory,
        [sessionId]: {
          ...(state.slotHistory[sessionId] ?? {}),
          [key]: entries,
        },
      },
    }));
  },

  toggleSessionSlot: async (sessionId, key, enabled) => {
    const existing = get().sessionSlots[sessionId] ?? [];
    const prev = existing.find((s) => s.key === key);
    const next: ContextSlot = { key, value: prev?.value ?? '', enabled };
    await upsertContextSlot(tauriDatabase, sessionId, next);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
      },
    }));
  },

  endSession: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.state.kind === 'ended') return;
    if (session.state.kind === 'running') {
      // Best-effort cancel — Rust TurnRegistry may have already removed the
      // run (process exited, app restarted, etc). A "turn not found" error
      // here must not block end-session: the session row is the source of
      // truth, not the in-memory registry.
      await cancelTurn(session.state.runId).catch(() => undefined);
    }

    const worktreePaths = get().sessionWorktrees[sessionId] ?? [];
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
    await deleteWorktreesForSession(tauriDatabase, sessionId);

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;
    const ended: TurnState = turnReducer(session.state, { kind: 'end', at: now() });
    await updateSessionState(tauriDatabase, sessionId, ended, now());
    const allAgents = get().sessionPhaseRuns[sessionId] ?? [];
    set((state) => {
      const next = { ...state.agentTurnState };
      for (const agent of allAgents) next[agent.id] = ended;
      return { agentTurnState: next };
    });
    applySessionUpdate(set, sessionId, ended);

    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      return { sessionWorktrees: nextWorktrees, sessionBranches: nextBranches };
    });
  },

  addWorkspace: async ({ rootPath, name }) => {
    const check = await validateGitRepo(rootPath);
    if (!check.isRepo || !check.rootPath) {
      throw new Error(check.error ?? 'not a git repository');
    }
    const resolvedRoot = check.rootPath;

    // Path-match reactivation: if the user previously disconnected a workspace
    // pointing at this path, "adding" it again clears the disconnect flag and
    // brings back all its sessions/worktrees/transcripts.
    const onDisk = await findWorkspaceByRootPath(tauriDatabase, resolvedRoot);
    if (onDisk) {
      if (!onDisk.disconnectedAt) {
        throw new Error(`workspace already exists: ${onDisk.name}`);
      }
      // Cap counts only active workspaces.
      if (get().workspaces.length >= MAX_WORKSPACES) {
        throw new Error(
          `workspace limit reached (${MAX_WORKSPACES}). disconnect one before adding another.`,
        );
      }
      const now = new Date().toISOString() as IsoDateTime;
      await reconnectWorkspaceInDb(tauriDatabase, onDisk.id, now);
      const reactivated: Workspace = { ...onDisk, updatedAt: now };
      delete (reactivated as { disconnectedAt?: IsoDateTime }).disconnectedAt;
      set((state) => ({ workspaces: [reactivated, ...state.workspaces] }));
      // Refresh side caches owned by this workspace; sessions hydrate lazily
      // via setCurrentWorkspace when the user actually picks it.
      try {
        const templates = await invokePhaseTemplateList(reactivated.id);
        set((state) => ({
          phaseTemplates: { ...state.phaseTemplates, [reactivated.id]: templates },
        }));
      } catch {
        // non-fatal: templates can be re-fetched on next workspace switch
      }
      return reactivated;
    }

    // New workspace path → enforce cap before insert.
    if (get().workspaces.length >= MAX_WORKSPACES) {
      throw new Error(
        `workspace limit reached (${MAX_WORKSPACES}). disconnect one before adding another.`,
      );
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

  /**
   * Soft "disconnect". Sessions, worktrees, transcripts are left untouched in
   * the DB. The workspace just stops appearing in the sidebar. Re-adding it
   * via `addWorkspace` with the same `rootPath` reactivates the row and brings
   * everything back. UI uses this everywhere; the destructive hard-delete on
   * `packages/db` is kept only for data-purge flows.
   */
  deleteWorkspace: async (id) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === id);
    if (!workspace) throw new Error(`workspace not found: ${id}`);

    // Cancel any running turns for this workspace so we don't leak processes
    // emitting events into a workspace the user can no longer see.
    const wasCurrentWorkspace = state.currentWorkspaceId === id;
    if (wasCurrentWorkspace) {
      const runningSessions = state.sessions.filter((s) => s.state.kind === 'running');
      await Promise.all(
        runningSessions.map((s) =>
          cancelTurn((s.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(() => {
            // best-effort: registry may already be clean
          }),
        ),
      );
    }

    const now = new Date().toISOString() as IsoDateTime;
    const prevWorkspaces = state.workspaces;

    // Optimistic: drop from sidebar list (and clear per-ws caches if it was
    // the active one).
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
      await disconnectWorkspaceInDb(tauriDatabase, id, now);
    } catch (err) {
      set((s) => ({
        workspaces: prevWorkspaces,
        ...(wasCurrentWorkspace ? { currentWorkspaceId: id } : {}),
      }));
      throw err;
    }
    void get().emitNotification(
      'workspace-deleted',
      'info',
      `Workspace disconnected: ${workspace.name}`,
      'Re-add the same path to bring it back with all its sessions.',
    );
  },

  loadScripts: async (workspaceId) => {
    const scripts = await listWorkspaceScripts(tauriDatabase, workspaceId);
    set((state) => ({
      workspaceScripts: { ...state.workspaceScripts, [workspaceId]: scripts },
    }));
  },

  saveScript: async ({ workspaceId, id, name, body }) => {
    const now = new Date().toISOString() as IsoDateTime;
    const existing = id
      ? (get().workspaceScripts[workspaceId] ?? []).find((s) => s.id === id)
      : undefined;
    const script: WorkspaceScript = {
      id: id ?? (crypto.randomUUID() as WorkspaceScriptId),
      workspaceId,
      name,
      body,
      sortOrder: existing?.sortOrder ?? get().workspaceScripts[workspaceId]?.length ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceScript(tauriDatabase, script);
    await get().loadScripts(workspaceId);
  },

  deleteScript: async (scriptId, workspaceId) => {
    await deleteWorkspaceScript(tauriDatabase, scriptId);
    set((state) => ({
      workspaceScripts: {
        ...state.workspaceScripts,
        [workspaceId]: (state.workspaceScripts[workspaceId] ?? []).filter((s) => s.id !== scriptId),
      },
    }));
  },

  runScript: async (scriptId) => {
    return invokeScriptRun(scriptId);
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

  loadPhaseRunsForSession: async (sessionId) => {
    const runs = await invokePhaseRunList(sessionId);
    set((state) => ({ sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: runs } }));
  },

  selectAgent: async (sessionId, agentId) => {
    // Stamp `lastViewedAt` on both the previously-selected agent (capturing
    // "user was looking at it until now") and the newly-selected agent. The
    // unread selector additionally treats the currently-selected agent as
    // viewed, so no visible flicker while you're actually on the row.
    const stampedAt = new Date().toISOString() as IsoDateTime;
    const prevAgentId = get().selectedAgentId[sessionId] ?? null;
    const stampAgents = new Set<AgentId>([agentId]);
    if (prevAgentId && prevAgentId !== agentId) stampAgents.add(prevAgentId);

    for (const id of stampAgents) {
      void invokeSessionMarkViewed(id, stampedAt).catch(() => undefined);
    }

    const stampRuns = (runs: ReadonlyArray<Agent>): ReadonlyArray<Agent> =>
      runs.map((s) => (stampAgents.has(s.id) ? { ...s, lastViewedAt: stampedAt } : s));

    const cached = get().transcripts[agentId];
    if (cached) {
      // eslint-disable-next-line no-console
      console.log(`[perf] selectAgent:${agentId} cached`);
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },
          sessionLoading: {
            ...state.sessionLoading,
            [sessionId]: { ...current, transcript: false },
          },
          sessionPhaseRuns: {
            ...state.sessionPhaseRuns,
            [sessionId]: stampRuns(state.sessionPhaseRuns[sessionId] ?? []),
          },
        };
      });
      void get().refreshUnreadWorkspaces();
      return;
    }
    set((state) => {
      const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
      return {
        selectedAgentId: { ...state.selectedAgentId, [sessionId]: agentId },
        sessionLoading: {
          ...state.sessionLoading,
          [sessionId]: { ...current, transcript: true },
        },
      };
    });
    // Two-phase load: phase 1 fetches the recent slice fast (~50-150ms),
    // unblocks the chat skeleton, then phase 2 fills in older history in the
    // background. Sessions with <= INITIAL_LIMIT events get only phase 1.
    const INITIAL_LIMIT = 50;
    const tInitial = performance.now();
    try {
      const [messages, events] = await Promise.all([
        listMessagesForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
        listTurnEventsForAgent(tauriDatabase, agentId, { limit: INITIAL_LIMIT }),
      ]);
      // eslint-disable-next-line no-console
      console.log(
        `[perf] selectAgent:initial ${(performance.now() - tInitial).toFixed(0)}ms (${events.length} events)`,
      );
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          transcripts: { ...state.transcripts, [agentId]: events },
          messages: { ...state.messages, [sessionId]: messages },
          sessionLoading: {
            ...state.sessionLoading,
            [sessionId]: { ...current, transcript: false },
          },
          sessionPhaseRuns: {
            ...state.sessionPhaseRuns,
            [sessionId]: stampRuns(state.sessionPhaseRuns[sessionId] ?? []),
          },
        };
      });
      void get().refreshUnreadWorkspaces();
      // Phase 2: only when the recent slice was at the limit (more older
      // history likely exists). Fired non-awaited so the click flow returns.
      if (events.length === INITIAL_LIMIT) {
        const tFull = performance.now();
        void Promise.all([
          listMessagesForAgent(tauriDatabase, agentId),
          listTurnEventsForAgent(tauriDatabase, agentId),
        ])
          .then(([fullMessages, fullEvents]) => {
            // eslint-disable-next-line no-console
            console.log(
              `[perf] selectAgent:full ${(performance.now() - tFull).toFixed(0)}ms (${fullEvents.length} events)`,
            );
            // Replace only if the agent is still selected and the in-store
            // slice hasn't grown past the full snapshot via streaming.
            set((state) => {
              const current = state.transcripts[agentId];
              if (current && current.length > fullEvents.length) return {};
              return {
                transcripts: { ...state.transcripts, [agentId]: fullEvents },
                messages: { ...state.messages, [sessionId]: fullMessages },
              };
            });
          })
          .catch(() => {});
      }
    } catch (err) {
      set((state) => {
        const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
        return {
          sessionLoading: {
            ...state.sessionLoading,
            [sessionId]: { ...current, transcript: false },
          },
        };
      });
      throw err;
    }
  },

  spawnAgent: async (sessionId, args) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    let resolvedName = args.name;
    let stepPromptPrefix = '';
    if (args.stepId) {
      const templates = state.phaseTemplates[session.workspaceId] ?? [];
      const template = session.workflowId
        ? (templates.find((t) => t.id === session.workflowId) ?? null)
        : null;
      const step = template?.steps.find((s) => s.id === args.stepId) ?? null;
      if (step) {
        if (!resolvedName) resolvedName = step.name;
        stepPromptPrefix = step.promptPrefix;
      }
    }
    if (!resolvedName) {
      const existing = state.sessionPhaseRuns[sessionId] ?? [];
      resolvedName = `agent ${existing.length + 1}`;
    }
    const currentRuns = state.sessionPhaseRuns[sessionId] ?? [];
    const nextOrdinal = currentRuns.reduce((max, r) => Math.max(max, r.ordinal), -1) + 1;
    const inserted = await invokePhaseRunInsert({
      sessionId,
      ...(args.stepId !== undefined && { stepId: args.stepId }),
      ordinal: nextOrdinal,
      name: resolvedName,
      status: 'pending',
      ...(args.kindOverride !== undefined && { kind: args.kindOverride }),
    });
    const refreshed = await invokePhaseRunList(sessionId);
    set((s) => ({
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
      selectedAgentId: { ...s.selectedAgentId, [sessionId]: inserted.id },
      transcripts: { ...s.transcripts, [inserted.id]: [] },
      messages: { ...s.messages, [sessionId]: [] },
      agentTurnState: {
        ...s.agentTurnState,
        [inserted.id]: { kind: 'idle', lastActivityAt: new Date().toISOString() as IsoDateTime },
      },
      ...(args.model !== undefined && {
        agentModelOverride: { ...s.agentModelOverride, [inserted.id]: args.model },
      }),
      ...(args.kindOverride !== undefined && {
        agentKindOverride: { ...s.agentKindOverride, [inserted.id]: args.kindOverride },
      }),
    }));
    const baseKickoff = stepPromptPrefix.length > 0 ? stepPromptPrefix : (args.initialPrompt ?? '');
    const effectiveKind: AgentKind =
      args.kindOverride ??
      (inserted.kind as AgentKind | undefined) ??
      inferAgentKindFromName(resolvedName);
    const isImplementer = effectiveKind === 'implementer';
    let planSection = '';
    let planToConsume: PlanWithCount | null = null;
    if (isImplementer) {
      const { section: latestSection, plan: latestPlan } = await buildPlanKickoffSection(sessionId);
      const explicitPlan =
        args.triggeredPlanId !== undefined
          ? (get().sessionPlans[sessionId]?.find((p) => p.id === args.triggeredPlanId) ?? null)
          : null;
      planSection = explicitPlan
        ? ['Active plan to execute:', '', explicitPlan.bodyMd].join('\n')
        : latestSection;
      const workflowAutoConsume = args.stepId !== undefined && latestPlan?.status === 'active';
      planToConsume = explicitPlan ?? (workflowAutoConsume ? latestPlan : null);
    }
    const kickoff = composeKickoff(planSection, baseKickoff);
    if (kickoff.length > 0) {
      void get().sendTurn({ sessionId, agentId: inserted.id, content: kickoff });
    }

    if (planToConsume) {
      await invokeAddPlanConsumption(planToConsume.id, inserted.id);
      const refreshed = await invokeListPlansForSession(sessionId);
      const consumptions = await invokeListConsumptionsForPlan(planToConsume.id);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshed },
        planConsumptions: { ...state.planConsumptions, [planToConsume.id]: consumptions },
      }));
    }

    return inserted.id;
  },

  renameAgent: async (sessionId, agentId, name) => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    await tauriDatabase.execute('UPDATE agents SET name = ? WHERE id = ?', [trimmed, agentId]);
    const refreshed = await invokePhaseRunList(sessionId);
    set((s) => ({
      sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
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
    void invokeAgentSetKind(agentId, kind).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[store] failed to persist agent kind', err);
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

  deleteAgent: async (sessionId, agentId) => {
    await tauriDatabase.execute('DELETE FROM agents WHERE id = ?', [agentId]);
    const refreshed = await invokePhaseRunList(sessionId);
    set((s) => {
      const wasSelected = s.selectedAgentId[sessionId] === agentId;
      const nextSelected = { ...s.selectedAgentId };
      if (wasSelected) {
        const fallback = refreshed[0]?.id ?? null;
        if (fallback) nextSelected[sessionId] = fallback;
        else delete nextSelected[sessionId];
      }
      return {
        sessionPhaseRuns: { ...s.sessionPhaseRuns, [sessionId]: refreshed },
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

  setSessionMergeConflicts: (sessionId, conflicts) => {
    set((state) => ({
      sessionMergeConflicts: { ...state.sessionMergeConflicts, [sessionId]: conflicts },
    }));
  },

  resolveMergeConflicts: async (sessionId, picks, runStatuses) => {
    const conflicts = get().sessionMergeConflicts[sessionId] ?? [];
    await resolveConflicts({
      conflicts,
      runStatuses: runStatuses.map((rs) => ({
        runId: rs.runId as ProviderRunId,
        completedAt: rs.completedAt as IsoDateTime,
        status: rs.status as AgentStatus,
      })),
      strategy: 'manual',
      manualPicks: picks as Record<string, ProviderRunId>,
    });
    set((state) => {
      const next = { ...state.sessionMergeConflicts };
      delete next[sessionId];
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

  loadSessionOverrides: async (sessionId) => {
    const overrides = await invoke<OverrideSettings | null>('get_session_overrides', { sessionId });
    if (overrides) {
      set((state) => ({
        sessionOverrides: { ...state.sessionOverrides, [sessionId]: overrides },
      }));
    }
  },

  setTaskOverrides: async (sessionId, overrides) => {
    await invoke('set_session_overrides', { sessionId, overrides });
    set((state) => ({
      sessionOverrides: { ...state.sessionOverrides, [sessionId]: overrides },
    }));
  },

  renameTask: async (sessionId, goal) => {
    if (!goal.trim()) throw new Error('session name cannot be empty');
    const now = new Date().toISOString() as IsoDateTime;
    const prev = get().sessions.find((s) => s.id === sessionId);
    if (!prev) throw new Error(`session not found: ${sessionId}`);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, goal: goal.trim(), titleUserEdited: true, updatedAt: now } : s,
      ),
    }));
    try {
      await renameSessionInDb(tauriDatabase, sessionId, goal.trim(), now, true);
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? prev : s)),
      }));
      throw err;
    }
  },

  autoTitleSession: async (sessionId, title) => {
    if (!title.trim()) return;
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.titleUserEdited) return;
    const now = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? { ...s, goal: title.trim() } : s)),
    }));
    await renameSessionInDb(tauriDatabase, sessionId, title.trim(), now, false);
  },

  deleteTask: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.state.kind === 'running') {
      await cancelTurn((session.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(
        () => undefined,
      );
    }
    const worktreePaths = get().sessionWorktrees[sessionId] ?? [];
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
    await deleteSessionFromDb(tauriDatabase, sessionId);
    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      const nextTranscripts = { ...state.transcripts };
      for (const agent of state.sessionPhaseRuns[sessionId] ?? []) {
        delete nextTranscripts[agent.id];
      }
      return {
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
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

  exportConfig: async () => {
    return exportConfigToFile();
  },

  importConfig: async () => {
    return importConfigFromFile();
  },

  resolvePermissionRequest: async ({ sessionId, agentId, toolUseId, toolName, runId, scope }) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const now = new Date().toISOString() as IsoDateTime;

    if (scope === 'once') {
      set((state) => ({
        volatilePermissionAllows: new Set([...state.volatilePermissionAllows, toolUseId]),
      }));
    } else {
      const ruleDecision: PermissionDecisionKind = scope === 'deny' ? 'deny' : 'allow';
      const ruleScope = scope === 'deny' ? 'session' : scope;
      await invokePermissionRuleUpsert({
        scope: ruleScope,
        ...(ruleScope === 'workspace' ? { workspaceId: session.workspaceId } : {}),
        ...(ruleScope === 'session' ? { sessionId } : {}),
        patternTool: toolName,
        decision: ruleDecision,
        priority: 100,
      });
    }

    get().appendTurnEvent(agentId, sessionId, {
      kind: 'permission_decision',
      runId,
      toolUseId,
      decision: scope === 'deny' ? 'deny' : 'allow',
      ruleId: null,
      decidedBy: 'user',
      at: now,
    });
  },

  clearSessionNextActions: (sessionId) => {
    set((state) => {
      if (state.sessionNextActions[sessionId] === undefined) return {};
      const next = { ...state.sessionNextActions };
      delete next[sessionId];
      return { sessionNextActions: next };
    });
  },

  setSessionPermissionMode: async (sessionId, mode) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionPermissionMode(tauriDatabase, sessionId, mode, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, permissionMode: mode, updatedAt: now } : s,
      ),
    }));
  },

  setSessionAutoRun: async (sessionId, autoRun) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionAutoRun(tauriDatabase, sessionId, autoRun, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, autoRun, updatedAt: now } : s,
      ),
    }));
    if (autoRun) void get().maybeAutoAdvanceWorkflow(sessionId);
  },

  attachWorkflowToSession: async (sessionId, workflowId, options) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    if (session.workflowId) throw new Error('session already has a workflow');

    const templates = get().phaseTemplates[session.workspaceId] ?? [];
    const template = templates.find((t) => t.id === workflowId);
    if (!template) throw new Error(`workflow not found: ${workflowId}`);

    const autoRun = options?.autoRun === true;
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionWorkflow(tauriDatabase, sessionId, workflowId, autoRun, now);

    const existingRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const baseOrdinal = existingRuns.reduce((max, r) => Math.max(max, r.ordinal), -1);
    const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
    const newAgents: Agent[] = [];
    const agentModelOverrides: Record<string, string> = {};
    const agentKindOverrides: Record<string, string> = {};
    for (let i = 0; i < sortedSteps.length; i += 1) {
      const step = sortedSteps[i]!;
      const kind = inferAgentKindFromName(step.name);
      const agent = await invokePhaseRunInsert({
        sessionId,
        stepId: step.id,
        ordinal: baseOrdinal + 1 + i,
        name: step.name,
        status: 'pending',
        kind,
      });
      agentModelOverrides[agent.id] = step.modelOverride ?? AGENT_KIND_DEFAULTS[kind].model;
      agentKindOverrides[agent.id] = kind;
      newAgents.push(agent);
    }

    const transcriptEntries: Record<string, ReadonlyArray<never>> = {};
    const turnStateEntries: Record<string, { kind: 'draft' }> = {};
    for (const agent of newAgents) {
      transcriptEntries[agent.id] = [];
      turnStateEntries[agent.id] = { kind: 'draft' };
    }

    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, workflowId, autoRun, updatedAt: now } : s,
      ),
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: [...existingRuns, ...newAgents],
      },
      transcripts: { ...state.transcripts, ...transcriptEntries },
      agentTurnState: { ...state.agentTurnState, ...turnStateEntries },
      agentModelOverride: { ...state.agentModelOverride, ...agentModelOverrides },
      agentKindOverride: { ...state.agentKindOverride, ...agentKindOverrides },
    }));

    if (autoRun) void get().maybeAutoAdvanceWorkflow(sessionId);
  },

  setSessionUserStatus: async (sessionId, status) => {
    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionUserStatus(tauriDatabase, sessionId, status, now);
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, userStatus: status, updatedAt: now } : s,
      ),
    }));
  },

  activateWorkflowAgent: async (sessionId, agentId) => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const agent = runs.find((r) => r.id === agentId);
    if (!agent || !agent.stepId) throw new Error('agent not found or not a workflow agent');

    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || !session.workflowId) throw new Error('session has no workflow');

    const template = (get().phaseTemplates[session.workspaceId] ?? []).find(
      (t) => t.id === session.workflowId,
    );
    const step = template?.steps.find((s) => s.id === agent.stepId);
    const promptPrefix = step?.promptPrefix ?? '';

    set((s) => ({
      selectedAgentId: { ...s.selectedAgentId, [sessionId]: agentId },
      agentTurnState: {
        ...s.agentTurnState,
        [agentId]: {
          kind: 'idle' as const,
          lastActivityAt: new Date().toISOString() as IsoDateTime,
        },
      },
    }));

    const effectiveKind: AgentKind =
      (agent.kind as AgentKind | undefined) ?? inferAgentKindFromName(agent.name);
    const isImplementer = effectiveKind === 'implementer';
    const { section: planSection, plan: latestPlan } = isImplementer
      ? await buildPlanKickoffSection(sessionId)
      : { section: '', plan: null };
    const kickoff = composeKickoff(planSection, promptPrefix);
    if (kickoff.length > 0) {
      void get().sendTurn({ sessionId, agentId, content: kickoff });
    }

    if (isImplementer && latestPlan && latestPlan.status === 'active') {
      await invokeAddPlanConsumption(latestPlan.id, agentId);
      const refreshedPlans = await invokeListPlansForSession(sessionId);
      const consumptions = await invokeListConsumptionsForPlan(latestPlan.id);
      set((state) => ({
        sessionPlans: { ...state.sessionPlans, [sessionId]: refreshedPlans },
        planConsumptions: { ...state.planConsumptions, [latestPlan.id]: consumptions },
      }));
    }
  },

  maybeAutoAdvanceWorkflow: async (sessionId) => {
    const state = get();
    const session = state.sessions.find((s) => s.id === sessionId);
    if (!session || !session.autoRun || !session.workflowId) return;
    const template = (state.phaseTemplates[session.workspaceId] ?? []).find(
      (t) => t.id === session.workflowId,
    );
    if (!template) return;
    const runs = state.sessionPhaseRuns[sessionId] ?? [];
    if (runs.some((r) => r.status === 'failed')) return;
    const slots = state.sessionSlots[sessionId] ?? [];
    const hasOpenQuestions =
      (slots.find((s) => s.key === 'open_questions')?.value?.trim().length ?? 0) > 0;
    const summarizerBusy = state.summarizerStatus[sessionId]?.status === 'running';
    if (hasOpenQuestions || summarizerBusy) return;
    const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
    const nextPendingAgent = (() => {
      for (const step of sortedSteps) {
        const agent = runs.find((r) => r.stepId === step.id);
        if (!agent || agent.status !== 'pending') continue;
        const prevSteps = sortedSteps.filter((s) => s.ordinal < step.ordinal);
        const allDone = prevSteps.every((s) =>
          runs.some(
            (r) => r.stepId === s.id && (r.status === 'completed' || r.status === 'skipped'),
          ),
        );
        if (allDone) return agent;
        return null;
      }
      return null;
    })();
    if (!nextPendingAgent) return;
    const exceeded = state.budgetAlerts.some(
      (a) =>
        a.dismissedAt === undefined &&
        ((a.kind === 'session-exceeded' && a.sessionId === sessionId) ||
          a.kind === 'provider-exceeded'),
    );
    if (exceeded) return;
    await get().activateWorkflowAgent(sessionId, nextPendingAgent.id);
    void get().emitNotification(
      'agent-auto-spawn',
      'info',
      `agent auto-spawned: ${nextPendingAgent.name}`,
      undefined,
      { sessionId },
    );
  },
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
    };

    const workspaceOverride = workspaceId ? (state.workspaceOverrides[workspaceId] ?? null) : null;
    const sessionOverride = sessionId ? (state.sessionOverrides[sessionId] ?? null) : null;

    return resolveSettings({ global: globalSettings, workspaceOverride, sessionOverride });
  });
}
