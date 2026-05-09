import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  WorkflowPropagator,
  PermissionEngine,
  buildClaudeFlags,
  buildStepPrompt,
  nextStep,
  parseSlashCommand,
  resolveConflicts,
  resolveSettings,
  turnReducer,
  Summarizer,
  type ClaudeFlagSet,
  type FileConflict,
  type SlotKey,
} from '@kay-am/core';
import {
  getSetting,
  insertMessage,
  insertProviderRun,
  insertTask,
  insertTaskWorktree,
  insertTelemetry,
  insertWorkspace,
  deleteWorkspace,
  listContextSlotsForTask,
  listMessagesForTask,
  listTasksForWorkspace,
  listTelemetryForTask,
  listWorkspaces,
  listWorktreesForTask,
  deleteWorktreesForTask,
  renameTask as renameSessionInDb,
  deleteTask as deleteSessionFromDb,
  setSetting as dbSetSetting,
  summarizeTaskTelemetry,
  summarizeWorkspaceTelemetry,
  summarizeWorkspaceProviderTelemetry,
  updateProviderRunStatus,
  updateTaskState,
  upsertContextSlot,
  type TelemetrySummary,
  type ProviderTelemetrySummary,
} from '@kay-am/db';
import type {
  BudgetAlert,
  BudgetRule,
  ContextSlot,
  GlobalSettings,
  IsoDateTime,
  Message,
  MessageId,
  OverrideSettings,
  PermissionRequest,
  PermissionRequestId,
  PermissionRule,
  Step,
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
} from '@kay-am/types';
import { DEFAULT_TASK_PROVIDER_PREFERENCE } from '@kay-am/types';
import { computeCostUsd, computeCodexCostUsd, computeCursorCostUsd } from '@kay-am/core';
import { invokeSessionBudgetGet, invokeSessionBudgetSet } from '../budget';
import { runDbMigrations, tauriDatabase } from '../db';
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
import { getCodexPriceOverride, refreshPricingTable } from '../providerPricing';
import { runTurn, cancelTurn, encodeAuthRequiredMessage, isAuthErrorMessage } from '../turn';
import { createWorktree, removeWorktree, type CreatedWorktree } from '../worktree';
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
  type PhaseTemplateUpsertArgs,
} from '../phases';
import {
  detectParallelGroup,
  runParallelBranch,
  type ParallelBranchEffects,
} from './parallel-turn';
import { exportConfigToFile, importConfigFromFile } from '../config-export';

export type BootPhase =
  | 'pending'
  | 'migrating'
  | 'loading-settings'
  | 'detecting-cli'
  | 'loading-workspaces'
  | 'restoring-session'
  | 'ready'
  | 'error';

export type SystemAlertKind = 'audit-retry-corrupt' | 'audit-retry-exhausted';

export interface SystemAlert {
  readonly id: string;
  readonly kind: SystemAlertKind;
  readonly message: string;
  readonly createdAt: string;
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
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<TaskId, TaskBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly systemAlerts: ReadonlyArray<SystemAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<Workflow>>>;
  readonly sessionPhaseRuns: Readonly<Record<TaskId, ReadonlyArray<Session>>>;
  readonly sessionMergeConflicts: Readonly<Record<TaskId, ReadonlyArray<FileConflict>>>;
  readonly unknownPayloadCounts: Readonly<Record<string, number>>;
  readonly detectedEditors: ReadonlyArray<DetectedEditor>;
  readonly workspaceOverrides: Readonly<Record<WorkspaceId, OverrideSettings>>;
  readonly sessionOverrides: Readonly<Record<TaskId, OverrideSettings>>;
  readonly sidebarWorkspaceSearch: string;
  readonly sidebarSessionSearch: string;
  readonly sidebarStateFilter: ReadonlyArray<TurnState['kind']>;
  readonly sidebarProviderFilter: ReadonlyArray<ProviderId>;
}

export interface SummarizerSessionStatus {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
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
    providerPreference?: TaskProviderPreference;
    workflowId?: WorkflowId;
  }): Promise<{ session: Task; worktree: CreatedWorktree }>;
  loadTranscript(taskId: TaskId): Promise<void>;
  appendTurnEvent(taskId: TaskId, event: TurnEvent): void;
  resetTranscript(taskId: TaskId): void;
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
  deleteTask(taskId: TaskId): Promise<void>;
  setSidebarWorkspaceSearch(query: string): void;
  setSidebarSessionSearch(query: string): void;
  setSidebarStateFilter(states: ReadonlyArray<TurnState['kind']>): void;
  setSidebarProviderFilter(providers: ReadonlyArray<ProviderId>): void;
  exportConfig(): Promise<string | null>;
  importConfig(): Promise<import('@kay-am/types').ConfigBundleImportResult | null>;
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
  summarizerStatus: {},
  budgetRules: [],
  sessionBudgets: {},
  providerSpendBreakdown: [],
  budgetAlerts: [],
  skills: {},
  phaseTemplates: {},
  sessionPhaseRuns: {},
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

function messageToTurnEvent(message: Message): TurnEvent | null {
  if (message.role === 'user') {
    return {
      kind: 'user_text',
      runId: 'history' as ProviderRunId,
      text: message.content,
      at: message.createdAt,
    };
  }
  if (message.role === 'assistant') {
    return {
      kind: 'assistant_text',
      runId: 'history' as ProviderRunId,
      delta: message.content,
      at: message.createdAt,
    };
  }
  return null;
}

type SetFn = (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void;

function applySessionUpdate(set: SetFn, taskId: TaskId, state: TurnState): void {
  set((store) => ({
    sessions: store.sessions.map((s) =>
      s.id === taskId ? { ...s, state, updatedAt: new Date().toISOString() as IsoDateTime } : s,
    ),
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
  set((state) => ({
    summarizerStatus: {
      ...state.summarizerStatus,
      [taskId]: { status: 'running', lastUpdate: null, error: null },
    },
  }));

  try {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session) return;

    const providerId = session.providerPreference.defaultProvider;
    const summarizer = new Summarizer({ providerId, invokeFn: invoke });
    const prevSlots = get().sessionSlots[taskId] ?? [];
    const result = await summarizer.summarize({ prevSlots, turnInput, turnOutput });

    for (const upsert of result.delta.upserts) {
      const existing = (get().sessionSlots[taskId] ?? []).find((s) => s.key === upsert.key);
      const next: ContextSlot = {
        key: upsert.key,
        value: upsert.value,
        enabled: existing?.enabled ?? true,
      };
      await upsertContextSlot(tauriDatabase, taskId, next);
    }
    const refreshed = await listContextSlotsForTask(tauriDatabase, taskId);
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [taskId]: refreshed },
    }));

    const summarizerRunId = crypto.randomUUID() as ProviderRunId;
    const startedAt = now();
    await insertProviderRun(tauriDatabase, {
      id: summarizerRunId,
      taskId,
      provider: providerId,
      model: result.model,
      status: { kind: 'streaming', startedAt },
      createdAt: startedAt,
    });
    await updateProviderRunStatus(tauriDatabase, summarizerRunId, {
      kind: 'succeeded',
      finishedAt: now(),
    });
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
    await insertTelemetry(tauriDatabase, record);

    const [sessionSummary, workspaceSummary, telemetry, providerSummaries, budgetRules] =
      await Promise.all([
        summarizeTaskTelemetry(tauriDatabase, taskId),
        summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
        listTelemetryForTask(tauriDatabase, taskId),
        summarizeWorkspaceProviderTelemetry(tauriDatabase, session.workspaceId),
        invokeBudgetRuleList(),
      ]);
    set((state) => ({
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: { ...state.sessionTelemetry, [taskId]: telemetry },
      summarizerStatus: {
        ...state.summarizerStatus,
        [taskId]: { status: 'idle', lastUpdate: now(), error: null },
      },
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    }));
  } catch (err) {
    // never log api key — only the error message
    const message = err instanceof Error ? err.message : String(err);
    if (import.meta.env.DEV) {
      console.warn(`[summarizer] failed for session ${taskId}: ${message}`);
    }
    set((state) => ({
      summarizerStatus: {
        ...state.summarizerStatus,
        [taskId]: { status: 'error', lastUpdate: now(), error: message },
      },
    }));
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
      const errMsg = err instanceof Error ? err.message : String(err);

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

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  hydrate: async () => {
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
        getProviderStatus(),
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
      set({ providerStatus, cursorStatus, codexStatus, providers: buildProviderList(statuses) });

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
        lastWorkspaceRaw && lastWorkspaceRaw.length > 0 ? (lastWorkspaceRaw as WorkspaceId) : null;
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
    } catch (err) {
      set({
        bootPhase: 'error',
        error: err instanceof Error ? err.message : String(err),
        hydrated: true,
      });
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
      sessionWorktrees: {},
      sessionBranches: {},
      sessionPhaseRuns: {},
      sessionMergeConflicts: {},
      sessionBudgets: {},
      summarizerStatus: {},
      budgetAlerts: [],
      unknownPayloadCounts: {},
      sidebarSessionSearch: '',
      sidebarStateFilter: [],
      sidebarProviderFilter: [],
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
    set({ currentSessionId: id, sessionSummary: null });
    if (id) {
      const session = get().sessions.find((s) => s.id === id);
      const [messages, summary, telemetry, slots] = await Promise.all([
        listMessagesForTask(tauriDatabase, id),
        summarizeTaskTelemetry(tauriDatabase, id),
        listTelemetryForTask(tauriDatabase, id),
        listContextSlotsForTask(tauriDatabase, id),
      ]);
      const events = messages.map(messageToTurnEvent).filter((e): e is TurnEvent => e !== null);
      set((state) => ({
        sessionSummary: summary,
        messages: { ...state.messages, [id]: messages },
        transcripts: { ...state.transcripts, [id]: events },
        sessionTelemetry: { ...state.sessionTelemetry, [id]: telemetry },
        sessionSlots: { ...state.sessionSlots, [id]: slots },
      }));
      if (session?.workflowId) {
        const phaseRuns = await invokePhaseRunList(id);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [id]: phaseRuns },
        }));
      }
    }
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, id ?? '');
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
      getProviderStatus(),
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

  createSession: async ({ workspaceId, goal, branchPrefix, providerPreference, workflowId }) => {
    const workspace = (await listWorkspaces(tauriDatabase)).find((w) => w.id === workspaceId);
    if (!workspace) throw new Error(`workspace not found: ${workspaceId}`);

    const prefix = branchPrefix?.trim() || 'kay';
    const slugSeed = goal.trim().length > 0 ? goal : `session-${Date.now()}`;
    const worktree = await createWorktree({
      repoPath: workspace.rootPath,
      branchPrefix: prefix,
      slug: slugSeed,
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
      ...(workflowId !== undefined ? { workflowId } : {}),
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
    }));
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, session.id);

    return { session, worktree };
  },

  loadTranscript: async (taskId) => {
    const messages = await listMessagesForTask(tauriDatabase, taskId);
    const events = messages.map(messageToTurnEvent).filter((e): e is TurnEvent => e !== null);
    set((state) => ({
      messages: { ...state.messages, [taskId]: messages },
      transcripts: { ...state.transcripts, [taskId]: events },
    }));
  },

  appendTurnEvent: (taskId, event) => {
    set((state) => {
      const existing = state.transcripts[taskId] ?? [];
      const updatedTranscripts = { ...state.transcripts, [taskId]: [...existing, event] };
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
      return { transcripts: updatedTranscripts };
    });
  },

  resetTranscript: (taskId) => {
    set((state) => ({
      transcripts: { ...state.transcripts, [taskId]: [] },
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

    const userTurnText = content;
    let resolvedPrompt = content;

    const slashCmd = parseSlashCommand(content);
    if (slashCmd !== null) {
      const workspaceSkills = before.skills[session.workspaceId] ?? [];
      const skill = workspaceSkills.find((s) => s.name === slashCmd.name);
      if (!skill) {
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(taskId, {
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
        get().appendTurnEvent(taskId, {
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
        get().appendTurnEvent(taskId, {
          kind: 'skill_invocation',
          runId: skillRunId,
          skillName: result.skillName,
          args: result.args,
          at: now(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(taskId, {
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
        const nextDef = nextStep(template, freshRuns);
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
          if (prevDef && prevRun) {
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
      get().appendTurnEvent(taskId, {
        kind: 'error',
        runId,
        message:
          'All providers have exceeded their budget cap. Adjust budget rules or wait for the next billing period.',
        at: now(),
      });
      return;
    }

    const provider: ProviderId = routingDecision.selectedProvider;
    const model =
      phaseDefinition?.modelOverride && phaseDefinition.providerOverride === undefined
        ? phaseDefinition.modelOverride
        : routingDecision.selectedModel;

    const authState = get().authResults?.[provider] ?? null;
    if (authState?.state === 'disconnected') {
      const runId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(taskId, {
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

    if (parallelDispatch === null) {
      const userMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        taskId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
        ...(resolvedOverride !== undefined ? { providerOverride: resolvedOverride } : {}),
      };
      await insertMessage(tauriDatabase, userMessage);
      get().appendTurnEvent(taskId, {
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
      const inserted = await invokePhaseRunInsert({
        taskId,
        stepId: phaseDefinition.id,
        ordinal: phaseDefinition.ordinal,
        name: phaseDefinition.name,
        status: 'running',
        providerRunId: runId,
        startedAt: now(),
      });
      sessionId = inserted.id;
      const refreshedRuns = await invokePhaseRunList(taskId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: refreshedRuns },
      }));
      if (phaseTransitionEvent) {
        get().appendTurnEvent(taskId, { ...phaseTransitionEvent, runId });
      }
    }

    if (parallelDispatch === null) {
      let nextState: TurnState = session.state;
      if (nextState.kind === 'draft') {
        nextState = turnReducer(nextState, { kind: 'start', at: now() });
      }
      nextState = turnReducer(nextState, { kind: 'send', runId, at: now() });
      await updateTaskState(tauriDatabase, taskId, nextState, now());
      applySessionUpdate(set, taskId, nextState);
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
        });
        claudeFlags = {
          allowedTools: flags.allowedTools,
          disallowedTools: flags.disallowedTools,
          permissionMode: flags.permissionMode,
        };
      } catch (err) {
        console.error('permission rule load failed; falling back to empty rule set', err);
        claudeFlags = { allowedTools: [], disallowedTools: [], permissionMode: 'default' };
      }
    }

    // ---- Parallel-agents branch -----------------------------------------
    // Triggered iff: enableParallelAgents on + phaseTemplate active + current
    // phase has parallelGroup with >= 2 siblings (already resolved above).
    // Pre-flight: aggregate cost = single-run estimate × N. Existing single-run
    // pre-flight is the routing decision itself (resolveProviderForTurn already
    // selected the cheapest viable provider). For N runs we can only enforce a
    // soft N-multiplier check against budget rules — implemented as a guard
    // against runaway parallel spend if the user's session budget is set.
    if (parallelDispatch !== null) {
      const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
      if (!workspace) {
        get().appendTurnEvent(taskId, {
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

      // Aggregate budget pre-flight: if a session soft cap exists, ensure that
      // running N parallel turns would not blow past it on this turn alone. We
      // approximate per-turn cost from the most recent telemetry row for the
      // session as a conservative ceiling. If no telemetry exists yet, we skip
      // the check (no signal to compare against — first turn).
      const sessBudget = get().sessionBudgets[taskId];
      if (sessBudget) {
        const tele = get().sessionTelemetry[taskId] ?? [];
        const lastTurnCost = tele.length > 0 ? (tele[tele.length - 1]?.estimatedCostUsd ?? 0) : 0;
        const projected = lastTurnCost * N;
        const sessSpent = (get().sessionSummary?.estimatedCostUsd ?? 0) + projected;
        if (lastTurnCost > 0 && sessSpent > sessBudget.softCapUsd) {
          get().appendTurnEvent(taskId, {
            kind: 'error',
            runId: crypto.randomUUID() as ProviderRunId,
            message: `parallel turn aborted: projected spend (${sessSpent.toFixed(4)} USD) would exceed session soft cap (${sessBudget.softCapUsd.toFixed(4)} USD).`,
            at: now(),
          });
          return;
        }
      }

      // Persist user message once (mirrors single-run path).
      const userMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        taskId,
        role: 'user',
        content: userTurnText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, userMessage);

      // Mark session running with the FIRST runId (UI uses session.state.runId
      // for the legacy cancel path; for parallel groups, cancel routes through
      // cancelGroup via the scheduler handle inside runParallelBranch).
      const groupSessionRunId = crypto.randomUUID() as ProviderRunId;
      get().appendTurnEvent(taskId, {
        kind: 'user_text',
        runId: groupSessionRunId,
        text: userTurnText,
        at: userMessage.createdAt,
      });
      let nextStateP: TurnState = session.state;
      if (nextStateP.kind === 'draft') {
        nextStateP = turnReducer(nextStateP, { kind: 'start', at: now() });
      }
      nextStateP = turnReducer(nextStateP, {
        kind: 'send',
        runId: groupSessionRunId,
        at: now(),
      });
      await updateTaskState(tauriDatabase, taskId, nextStateP, now());
      applySessionUpdate(set, taskId, nextStateP);

      const effects: ParallelBranchEffects = {
        appendTurnEvent: (sid, ev) => get().appendTurnEvent(sid, ev),
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
          applySessionUpdate(set, taskId, errorState);
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
        const rawMessage = err instanceof Error ? err.message : String(err);
        get().appendTurnEvent(taskId, {
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
        applySessionUpdate(set, taskId, errorState);
        throw err;
      }
      return;
    }
    // ---- /Parallel-agents branch ----------------------------------------

    void refreshPricingTable();

    let assistantText = '';
    let lastError: unknown = null;

    try {
      for await (const event of runTurn({
        runId,
        model,
        workingDir,
        prompt: resolvedPrompt,
        binary: providerInfo?.binary,
        ...claudeFlags,
      })) {
        get().appendTurnEvent(taskId, event);
        if (event.kind === 'assistant_text') assistantText += event.delta;

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
          const decision = engine.decide(request, effectiveRules, {
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
          const cost =
            provider === 'codex'
              ? computeCodexCostUsd(event.usage, model, getCodexPriceOverride(null, model))
              : provider === 'cursor'
                ? computeCursorCostUsd(event.usage, model)
                : computeCostUsd(event.usage, model);
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
            applySessionUpdate(set, taskId, reduced);
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
        applySessionUpdate(set, taskId, idleState);
        if (assistantText.length === 0) {
          get().appendTurnEvent(taskId, {
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
      if (sessionId && phaseDefinition) {
        const completedOrdinal = phaseDefinition.ordinal;
        await invokePhaseRunUpdateStatus(sessionId, {
          status: 'completed',
          outputSummary: assistantText.slice(0, 2000),
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(taskId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [taskId]: refreshedRuns },
          sessions: state.sessions.map((s) =>
            s.id === taskId ? { ...s, currentStepOrdinal: completedOrdinal } : s,
          ),
        }));
      }
    } catch (err) {
      lastError = err;
      const rawMessage = err instanceof Error ? err.message : String(err);
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
      applySessionUpdate(set, taskId, errorState);
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: rawMessage,
      });
      get().appendTurnEvent(taskId, {
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
        role: 'assistant',
        content: assistantText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, assistantMessage);
    }

    if (!lastError && assistantText.length > 0) {
      void runSummarizer(set, get, taskId, resolvedPrompt, assistantText);
    }

    if (lastError) throw lastError;
  },

  cancelCurrentTurn: async (taskId) => {
    const session = get().sessions.find((s) => s.id === taskId);
    if (!session || session.state.kind !== 'running') return;
    // Best-effort: if the registry already evicted the run we still want to
    // normalize session state locally so the UI re-enables the input.
    await cancelTurn(session.state.runId).catch(() => undefined);
    const now = new Date().toISOString() as IsoDateTime;
    const idleState: TurnState = { kind: 'idle', lastActivityAt: now };
    await updateTaskState(tauriDatabase, taskId, idleState, now).catch(() => undefined);
    applySessionUpdate(set, taskId, idleState);
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
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    await upsertContextSlot(tauriDatabase, taskId, next);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [taskId]: mergeSlots(state.sessionSlots[taskId] ?? [], next),
      },
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
          console.warn(
            `worktree_remove failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
    await deleteWorktreesForTask(tauriDatabase, taskId);

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;
    const ended: TurnState = turnReducer(session.state, { kind: 'end', at: now() });
    await updateTaskState(tauriDatabase, taskId, ended, now());
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
    await insertWorkspace(tauriDatabase, workspace);
    set((state) => ({ workspaces: [workspace, ...state.workspaces] }));
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
            sessionWorktrees: {},
            sessionPhaseRuns: {},
            sessionBudgets: {},
            summarizerStatus: {},
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
    const overrides = await invoke<OverrideSettings | null>('get_session_overrides', { taskId });
    if (overrides) {
      set((state) => ({
        sessionOverrides: { ...state.sessionOverrides, [taskId]: overrides },
      }));
    }
  },

  setTaskOverrides: async (taskId, overrides) => {
    await invoke('set_session_overrides', { taskId, overrides });
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
        s.id === taskId ? { ...s, goal: goal.trim(), updatedAt: now } : s,
      ),
    }));
    try {
      await renameSessionInDb(tauriDatabase, taskId, goal.trim(), now);
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === taskId ? prev : s)),
      }));
      throw err;
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
    await deleteSessionFromDb(tauriDatabase, taskId);
    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[taskId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[taskId];
      return {
        sessions: state.sessions.filter((s) => s.id !== taskId),
        currentSessionId: state.currentSessionId === taskId ? null : state.currentSessionId,
        sessionWorktrees: nextWorktrees,
        sessionBranches: nextBranches,
      };
    });
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
