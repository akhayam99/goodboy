import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import {
  PhaseContextPropagator,
  PermissionEngine,
  buildClaudeFlags,
  buildPhasePrompt,
  nextPhase,
  parseSlashCommand,
  sessionReducer,
  Summarizer,
  type ClaudeFlagSet,
  type SlotKey,
} from '@kay-am/core';
import {
  getSetting,
  insertMessage,
  insertProviderRun,
  insertSession,
  insertTelemetry,
  insertWorkspace,
  listContextSlotsForSession,
  listMessagesForSession,
  listSessionsForWorkspace,
  listTelemetryForSession,
  listWorkspaces,
  setSetting as dbSetSetting,
  summarizeSessionTelemetry,
  summarizeWorkspaceTelemetry,
  summarizeWorkspaceProviderTelemetry,
  updateProviderRunStatus,
  updateSessionState,
  upsertContextSlot,
  type TelemetrySummary,
  type ProviderTelemetrySummary,
} from '@kay-am/db';
import type {
  BudgetAlert,
  BudgetRule,
  ContextSlot,
  IsoDateTime,
  Message,
  MessageId,
  PermissionRequest,
  PermissionRequestId,
  PermissionRule,
  PhaseDefinition,
  PhaseRun,
  PhaseRunId,
  PhaseTemplate,
  PhaseTemplateId,
  ProviderId,
  ProviderRun,
  ProviderRunId,
  Session,
  SessionBudget,
  SessionId,
  SessionProviderPreference,
  SessionState,
  Skill,
  SkillId,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  TurnProviderOverride,
  Workspace,
  WorkspaceId,
} from '@kay-am/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@kay-am/types';
import { computeCostUsd } from '@kay-am/core';
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
import { validateGitRepo } from '../repo';
import { resolveProviderForTurn } from '../routing';
import {
  SETTING_EDITOR_BINARY,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
} from '../settings';
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
import { invokePermissionRuleList, invokePermissionAuditInsert } from '../permissions';
import {
  invokePhaseTemplateList,
  invokePhaseTemplateUpsert,
  invokePhaseTemplateDelete,
  invokePhaseRunList,
  invokePhaseRunInsert,
  invokePhaseRunUpdateStatus,
  type PhaseTemplateUpsertArgs,
} from '../phases';

export type BootPhase =
  | 'pending'
  | 'migrating'
  | 'loading-settings'
  | 'detecting-cli'
  | 'loading-workspaces'
  | 'restoring-session'
  | 'ready'
  | 'error';

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
  readonly sessionWorktrees: Readonly<Record<string, string>>;
  readonly sessionTelemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  readonly workspaceSummary: TelemetrySummary | null;
  readonly sessionSlots: Readonly<Record<string, ReadonlyArray<ContextSlot>>>;
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
  readonly budgetRules: ReadonlyArray<BudgetRule>;
  readonly sessionBudgets: Readonly<Record<SessionId, SessionBudget>>;
  readonly providerSpendBreakdown: ReadonlyArray<ProviderSpendEntry>;
  readonly budgetAlerts: ReadonlyArray<BudgetAlert>;
  readonly skills: Readonly<Record<WorkspaceId, ReadonlyArray<Skill>>>;
  readonly phaseTemplates: Readonly<Record<WorkspaceId, ReadonlyArray<PhaseTemplate>>>;
  readonly sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<PhaseRun>>>;
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
  setCurrentSession(id: SessionId | null): Promise<void>;
  refreshSessions(workspaceId: WorkspaceId): Promise<void>;
  refreshSessionSummary(sessionId: SessionId): Promise<void>;
  loadSetting(key: string): Promise<string | null>;
  saveSetting(key: string, value: string): Promise<void>;
  refreshProviderStatus(status: ProviderStatus): void;
  refreshProviders(): Promise<void>;
  addWorkspace(input: { rootPath: string; name?: string }): Promise<Workspace>;
  createSession(input: {
    workspaceId: WorkspaceId;
    goal: string;
    branchPrefix?: string;
    providerPreference?: SessionProviderPreference;
    phaseTemplateId?: PhaseTemplateId;
  }): Promise<{ session: Session; worktree: CreatedWorktree }>;
  loadTranscript(sessionId: SessionId): Promise<void>;
  appendTurnEvent(sessionId: SessionId, event: TurnEvent): void;
  resetTranscript(sessionId: SessionId): void;
  sendTurn(input: {
    sessionId: SessionId;
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
  loadPhaseTemplates(workspaceId: WorkspaceId): Promise<void>;
  savePhaseTemplate(template: PhaseTemplateUpsertArgs): Promise<void>;
  deletePhaseTemplate(id: PhaseTemplateId, workspaceId: WorkspaceId): Promise<void>;
  loadPhaseRunsForSession(sessionId: SessionId): Promise<void>;
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
  if (message.role !== 'assistant') return null;
  return {
    kind: 'assistant_text',
    runId: 'history' as ProviderRunId,
    delta: message.content,
    at: message.createdAt,
  };
}

type SetFn = (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void;

function applySessionUpdate(set: SetFn, sessionId: SessionId, state: SessionState): void {
  set((store) => ({
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, state, updatedAt: new Date().toISOString() as IsoDateTime } : s,
    ),
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
  set((state) => ({
    summarizerStatus: {
      ...state.summarizerStatus,
      [sessionId]: { status: 'running', lastUpdate: null, error: null },
    },
  }));

  try {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const providerId = session.providerPreference.defaultProvider;
    const summarizer = new Summarizer({ providerId, invokeFn: invoke });
    const prevSlots = get().sessionSlots[sessionId] ?? [];
    const result = await summarizer.summarize({ prevSlots, turnInput, turnOutput });

    for (const upsert of result.delta.upserts) {
      const existing = (get().sessionSlots[sessionId] ?? []).find((s) => s.key === upsert.key);
      const next: ContextSlot = {
        key: upsert.key,
        value: upsert.value,
        enabled: existing?.enabled ?? true,
      };
      await upsertContextSlot(tauriDatabase, sessionId, next);
    }
    const refreshed = await listContextSlotsForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionSlots: { ...state.sessionSlots, [sessionId]: refreshed },
    }));

    const summarizerRunId = crypto.randomUUID() as ProviderRunId;
    const startedAt = now();
    await insertProviderRun(tauriDatabase, {
      id: summarizerRunId,
      sessionId,
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
      sessionId,
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
        summarizeSessionTelemetry(tauriDatabase, sessionId),
        summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
        listTelemetryForSession(tauriDatabase, sessionId),
        summarizeWorkspaceProviderTelemetry(tauriDatabase, session.workspaceId),
        invokeBudgetRuleList(),
      ]);
    set((state) => ({
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: telemetry },
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: { status: 'idle', lastUpdate: now(), error: null },
      },
      providerSpendBreakdown: buildProviderSpendBreakdown(providerSummaries, budgetRules),
    }));
  } catch (err) {
    // never log api key — only the error message
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[summarizer] failed for session ${sessionId}: ${message}`);
    set((state) => ({
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: { status: 'error', lastUpdate: now(), error: message },
      },
    }));
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
          lastSessionRaw && lastSessionRaw.length > 0 ? (lastSessionRaw as SessionId) : null;
        if (lastSessionId) {
          const sessions = get().sessions;
          if (sessions.some((s) => s.id === lastSessionId)) {
            await get().setCurrentSession(lastSessionId);
          }
        }
      }

      set({ bootPhase: 'ready', hydrated: true });
    } catch (err) {
      set({
        bootPhase: 'error',
        error: err instanceof Error ? err.message : String(err),
        hydrated: true,
      });
    }
  },

  setCurrentWorkspace: async (id) => {
    set({
      currentWorkspaceId: id,
      currentSessionId: null,
      sessions: [],
      sessionSummary: null,
      workspaceSummary: null,
    });
    if (id) {
      const [sessions, workspaceSummary, providerSummaries, budgetRules, skills, phaseTemplates] =
        await Promise.all([
          listSessionsForWorkspace(tauriDatabase, id),
          summarizeWorkspaceTelemetry(tauriDatabase, id),
          summarizeWorkspaceProviderTelemetry(tauriDatabase, id),
          invokeBudgetRuleList(),
          invokeSkillList(id),
          invokePhaseTemplateList(id),
        ]);
      set((state) => ({
        sessions,
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
        listMessagesForSession(tauriDatabase, id),
        summarizeSessionTelemetry(tauriDatabase, id),
        listTelemetryForSession(tauriDatabase, id),
        listContextSlotsForSession(tauriDatabase, id),
      ]);
      const events = messages.map(messageToTurnEvent).filter((e): e is TurnEvent => e !== null);
      set((state) => ({
        sessionSummary: summary,
        messages: { ...state.messages, [id]: messages },
        transcripts: { ...state.transcripts, [id]: events },
        sessionTelemetry: { ...state.sessionTelemetry, [id]: telemetry },
        sessionSlots: { ...state.sessionSlots, [id]: slots },
      }));
      if (session?.phaseTemplateId) {
        const phaseRuns = await invokePhaseRunList(id);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [id]: phaseRuns },
        }));
      }
    }
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, id ?? '');
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

  createSession: async ({
    workspaceId,
    goal,
    branchPrefix,
    providerPreference,
    phaseTemplateId,
  }) => {
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
    const initialState: SessionState = { kind: 'draft' };
    const session: Session = {
      id: crypto.randomUUID() as SessionId,
      workspaceId,
      goal: goal.trim() || worktree.slug,
      state: initialState,
      contextSlots: [],
      providerPreference: providerPreference ?? DEFAULT_SESSION_PROVIDER_PREFERENCE,
      ...(phaseTemplateId !== undefined ? { phaseTemplateId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await insertSession(tauriDatabase, session);

    set((state) => ({
      sessions:
        state.currentWorkspaceId === workspaceId ? [session, ...state.sessions] : state.sessions,
      currentSessionId: session.id,
      sessionSummary: null,
      sessionWorktrees: { ...state.sessionWorktrees, [session.id]: worktree.worktreePath },
    }));
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, session.id);

    return { session, worktree };
  },

  loadTranscript: async (sessionId) => {
    const messages = await listMessagesForSession(tauriDatabase, sessionId);
    const events = messages.map(messageToTurnEvent).filter((e): e is TurnEvent => e !== null);
    set((state) => ({
      messages: { ...state.messages, [sessionId]: messages },
      transcripts: { ...state.transcripts, [sessionId]: events },
    }));
  },

  appendTurnEvent: (sessionId, event) => {
    set((state) => {
      const existing = state.transcripts[sessionId] ?? [];
      return {
        transcripts: { ...state.transcripts, [sessionId]: [...existing, event] },
      };
    });
  },

  resetTranscript: (sessionId) => {
    set((state) => ({
      transcripts: { ...state.transcripts, [sessionId]: [] },
    }));
  },

  sendTurn: async ({ sessionId, content, override, onNewAlerts }) => {
    const before = get();
    const session = before.sessions.find((s) => s.id === sessionId);
    if (!session) throw new Error(`session not found: ${sessionId}`);
    const workingDir = before.sessionWorktrees[sessionId];
    if (!workingDir) {
      throw new Error(
        'session worktree not initialized — open a fresh session (worktree paths are not yet persisted across restarts)',
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
        get().appendTurnEvent(sessionId, {
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
        get().appendTurnEvent(sessionId, {
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
        get().appendTurnEvent(sessionId, {
          kind: 'skill_invocation',
          runId: skillRunId,
          skillName: result.skillName,
          args: result.args,
          at: now(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errRunId = crypto.randomUUID() as ProviderRunId;
        get().appendTurnEvent(sessionId, {
          kind: 'error',
          runId: errRunId,
          message,
          at: now(),
        });
        return;
      }
    }

    let phaseDefinition: PhaseDefinition | null = null;
    let phasePromptCarryForward = '';
    let phaseTransitionEvent: Extract<TurnEvent, { kind: 'phase_transition' }> | null = null;

    if (session.phaseTemplateId) {
      const templates = get().phaseTemplates[session.workspaceId] ?? [];
      const template = templates.find((t) => t.id === session.phaseTemplateId) ?? null;
      if (template) {
        const freshRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: freshRuns },
        }));
        const nextDef = nextPhase(template, freshRuns);
        if (nextDef) {
          const sortedDefs = [...template.definitions].sort((a, b) => a.ordinal - b.ordinal);
          const prevDef =
            sortedDefs
              .filter((d) => d.ordinal < nextDef.ordinal)
              .reverse()
              .find((d) =>
                freshRuns.some((r) => r.phaseDefinitionId === d.id && r.status === 'completed'),
              ) ?? null;
          const prevRun = prevDef
            ? (freshRuns.find(
                (r) => r.phaseDefinitionId === prevDef.id && r.status === 'completed',
              ) ?? null)
            : null;
          if (prevDef && prevRun) {
            const propagator = new PhaseContextPropagator({
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
              kind: 'phase_transition',
              runId: 'pending' as ProviderRunId,
              fromPhase: { ordinal: prevDef.ordinal, name: prevDef.name },
              toPhase: { ordinal: nextDef.ordinal, name: nextDef.name },
              carryForwardContext: transition.carryForwardContext,
              at: transition.at,
            };
          }
          phaseDefinition = nextDef;
          resolvedPrompt = buildPhasePrompt({
            definition: nextDef,
            carryForwardContext: phasePromptCarryForward,
            userMessage: resolvedPrompt,
          });
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
      get().appendTurnEvent(sessionId, {
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
      get().appendTurnEvent(sessionId, {
        kind: 'error',
        runId,
        message: encodeAuthRequiredMessage({ providerId: provider, identity: authState.identity }),
        at: now(),
      });
      return;
    }

    const resolvedOverride =
      session.providerPreference.allowTurnOverride && override != null ? override : undefined;
    const userMessage: Message = {
      id: crypto.randomUUID() as MessageId,
      sessionId,
      role: 'user',
      content: userTurnText,
      createdAt: now(),
      ...(resolvedOverride !== undefined ? { providerOverride: resolvedOverride } : {}),
    };
    await insertMessage(tauriDatabase, userMessage);

    const runId = crypto.randomUUID() as ProviderRunId;
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

    let phaseRunId: PhaseRunId | null = null;
    if (phaseDefinition) {
      const inserted = await invokePhaseRunInsert({
        sessionId,
        phaseDefinitionId: phaseDefinition.id,
        ordinal: phaseDefinition.ordinal,
        name: phaseDefinition.name,
        status: 'running',
        providerRunId: runId,
        startedAt: now(),
      });
      phaseRunId = inserted.id;
      const refreshedRuns = await invokePhaseRunList(sessionId);
      set((state) => ({
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
      }));
      if (phaseTransitionEvent) {
        get().appendTurnEvent(sessionId, { ...phaseTransitionEvent, runId });
      }
    }

    let nextState: SessionState = session.state;
    if (nextState.kind === 'draft') {
      nextState = sessionReducer(nextState, { kind: 'start', at: now() });
    }
    nextState = sessionReducer(nextState, { kind: 'send', runId, at: now() });
    await updateSessionState(tauriDatabase, sessionId, nextState, now());
    applySessionUpdate(set, sessionId, nextState);

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
        get().appendTurnEvent(sessionId, event);
        if (event.kind === 'assistant_text') assistantText += event.delta;

        if (provider === 'anthropic' && event.kind === 'tool_call_start') {
          try {
            const engine = new PermissionEngine();
            const request: PermissionRequest = {
              id: crypto.randomUUID() as PermissionRequestId,
              runId,
              toolUseId: event.toolUseId,
              toolName: event.toolName,
              input: event.input,
              at: event.at,
            };
            const decision = engine.decide(request, effectiveRules, {
              sessionId,
              workspaceId: session.workspaceId,
            });
            await invokePermissionAuditInsert({
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
            });
          } catch (err) {
            console.error('permission audit insert failed', err);
          }
        }

        if (event.kind === 'usage') {
          const cost = computeCostUsd(event.usage, model);
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
          const reduced = sessionReducer(current.state, { kind: 'receive_event', event });
          if (reduced !== current.state) {
            await updateSessionState(tauriDatabase, sessionId, reduced, now());
            applySessionUpdate(set, sessionId, reduced);
          }
        }
      }
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'succeeded',
        finishedAt: now(),
      });
      if (phaseRunId && phaseDefinition) {
        const completedOrdinal = phaseDefinition.ordinal;
        await invokePhaseRunUpdateStatus(phaseRunId, {
          status: 'completed',
          outputSummary: assistantText.slice(0, 2000),
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, currentPhaseOrdinal: completedOrdinal } : s,
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
      const errorState: SessionState = {
        kind: 'error',
        message: rawMessage,
        failedAt: now(),
      };
      await updateSessionState(tauriDatabase, sessionId, errorState, now());
      applySessionUpdate(set, sessionId, errorState);
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: rawMessage,
      });
      get().appendTurnEvent(sessionId, {
        kind: 'error',
        runId,
        message,
        at: now(),
      });
      if (phaseRunId) {
        await invokePhaseRunUpdateStatus(phaseRunId, {
          status: 'failed',
          completedAt: now(),
        });
        const refreshedRuns = await invokePhaseRunList(sessionId);
        set((state) => ({
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshedRuns },
        }));
      }
    }

    if (assistantText.length > 0) {
      const assistantMessage: Message = {
        id: crypto.randomUUID() as MessageId,
        sessionId,
        role: 'assistant',
        content: assistantText,
        createdAt: now(),
      };
      await insertMessage(tauriDatabase, assistantMessage);
    }

    if (!lastError && assistantText.length > 0) {
      void runSummarizer(set, get, sessionId, resolvedPrompt, assistantText);
    }

    if (lastError) throw lastError;
  },

  cancelCurrentTurn: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.state.kind !== 'running') return;
    await cancelTurn(session.state.runId);
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
    const next: ContextSlot = { key, value, enabled: prev?.enabled ?? true };
    await upsertContextSlot(tauriDatabase, sessionId, next);
    set((state) => ({
      sessionSlots: {
        ...state.sessionSlots,
        [sessionId]: mergeSlots(state.sessionSlots[sessionId] ?? [], next),
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
      await cancelTurn(session.state.runId);
    }

    const worktreePath = get().sessionWorktrees[sessionId];
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (worktreePath && workspace) {
      try {
        await removeWorktree(workspace.rootPath, worktreePath);
      } catch (err) {
        // worktree may already be gone — surface as warning, continue ending
        console.warn(`worktree_remove failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const now = (): IsoDateTime => new Date().toISOString() as IsoDateTime;
    const ended: SessionState = sessionReducer(session.state, { kind: 'end', at: now() });
    await updateSessionState(tauriDatabase, sessionId, ended, now());
    applySessionUpdate(set, sessionId, ended);

    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[sessionId];
      return { sessionWorktrees: nextWorktrees };
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

  loadSessionBudget: async (sessionId) => {
    const budget = await invokeSessionBudgetGet(sessionId);
    if (budget !== null) {
      set((state) => ({
        sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
      }));
    }
  },

  setSessionBudget: async (sessionId, softCapUsd) => {
    await invokeSessionBudgetSet(sessionId, softCapUsd);
    const budget: SessionBudget = { sessionId, softCapUsd };
    set((state) => ({
      sessionBudgets: { ...state.sessionBudgets, [sessionId]: budget },
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

  deletePhaseTemplate: async (id, workspaceId) => {
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
}));
