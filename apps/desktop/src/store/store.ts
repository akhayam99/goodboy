import { create } from 'zustand';
import { sessionReducer, Summarizer, getDefaultTurnModel, type SlotKey } from '@kay-am/core';
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
  updateProviderRunStatus,
  updateSessionState,
  upsertContextSlot,
  type TelemetrySummary,
} from '@kay-am/db';
import type {
  ContextSlot,
  IsoDateTime,
  Message,
  MessageId,
  ProviderRun,
  ProviderRunId,
  Session,
  SessionId,
  SessionProviderPreference,
  SessionState,
  TelemetryRecord,
  TelemetryRecordId,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@kay-am/types';
import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@kay-am/types';
import { computeCostUsd } from '@kay-am/core';
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
import { ANTHROPIC_API_KEY_SECRET, getSecret, hasSecret } from '../secrets';
import {
  SETTING_EDITOR_BINARY,
  SETTING_LAST_SESSION_ID,
  SETTING_LAST_WORKSPACE_ID,
} from '../settings';
import { runTurn, cancelTurn, encodeAuthRequiredMessage, isAuthErrorMessage } from '../turn';
import { createWorktree, removeWorktree, type CreatedWorktree } from '../worktree';

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
  readonly apiKeyPresent: boolean;
  readonly error: string | null;
  readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  readonly messages: Readonly<Record<string, ReadonlyArray<Message>>>;
  readonly sessionWorktrees: Readonly<Record<string, string>>;
  readonly sessionTelemetry: Readonly<Record<string, ReadonlyArray<TelemetryRecord>>>;
  readonly workspaceSummary: TelemetrySummary | null;
  readonly sessionSlots: Readonly<Record<string, ReadonlyArray<ContextSlot>>>;
  readonly summarizerStatus: Readonly<Record<string, SummarizerSessionStatus>>;
}

export interface SummarizerSessionStatus {
  readonly status: 'idle' | 'running' | 'error';
  readonly lastUpdate: IsoDateTime | null;
  readonly error: string | null;
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
  }): Promise<{ session: Session; worktree: CreatedWorktree }>;
  loadTranscript(sessionId: SessionId): Promise<void>;
  appendTurnEvent(sessionId: SessionId, event: TurnEvent): void;
  resetTranscript(sessionId: SessionId): void;
  sendTurn(input: { sessionId: SessionId; content: string }): Promise<void>;
  cancelCurrentTurn(sessionId: SessionId): Promise<void>;
  endSession(sessionId: SessionId): Promise<void>;
  refreshWorkspaceSummary(workspaceId: WorkspaceId): Promise<void>;
  loadSessionTelemetry(sessionId: SessionId): Promise<void>;
  refreshApiKeyPresence(): Promise<void>;
  loadSessionSlots(sessionId: SessionId): Promise<void>;
  upsertSessionSlot(sessionId: SessionId, key: SlotKey, value: string): Promise<void>;
  toggleSessionSlot(sessionId: SessionId, key: SlotKey, enabled: boolean): Promise<void>;
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
  apiKeyPresent: false,
  error: null,
  transcripts: {},
  messages: {},
  sessionWorktrees: {},
  sessionTelemetry: {},
  workspaceSummary: null,
  sessionSlots: {},
  summarizerStatus: {},
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
  apiKey: string,
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

    const summarizer = new Summarizer({ apiKey });
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
      provider: 'anthropic',
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
      provider: 'anthropic',
      model: result.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      estimatedCostUsd: result.usage.estimatedCostUsd,
      recordedAt: now(),
    };
    await insertTelemetry(tauriDatabase, record);

    const [sessionSummary, workspaceSummary, telemetry] = await Promise.all([
      summarizeSessionTelemetry(tauriDatabase, sessionId),
      summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
      listTelemetryForSession(tauriDatabase, sessionId),
    ]);
    set((state) => ({
      sessionSummary,
      workspaceSummary,
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: telemetry },
      summarizerStatus: {
        ...state.summarizerStatus,
        [sessionId]: { status: 'idle', lastUpdate: now(), error: null },
      },
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
      const [editorBinary, lastWorkspaceRaw, lastSessionRaw, apiKeyPresent] = await Promise.all([
        getSetting(tauriDatabase, SETTING_EDITOR_BINARY),
        getSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID),
        getSetting(tauriDatabase, SETTING_LAST_SESSION_ID),
        hasSecret(ANTHROPIC_API_KEY_SECRET),
      ]);
      set((state) => {
        const next = { ...state.settings };
        if (editorBinary !== null) next[SETTING_EDITOR_BINARY] = editorBinary;
        if (lastWorkspaceRaw !== null) next[SETTING_LAST_WORKSPACE_ID] = lastWorkspaceRaw;
        if (lastSessionRaw !== null) next[SETTING_LAST_SESSION_ID] = lastSessionRaw;
        return { settings: next, apiKeyPresent };
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
      const [sessions, workspaceSummary] = await Promise.all([
        listSessionsForWorkspace(tauriDatabase, id),
        summarizeWorkspaceTelemetry(tauriDatabase, id),
      ]);
      set({ sessions, workspaceSummary });
    }
    await dbSetSetting(tauriDatabase, SETTING_LAST_WORKSPACE_ID, id ?? '');
    await dbSetSetting(tauriDatabase, SETTING_LAST_SESSION_ID, '');
  },

  setCurrentSession: async (id) => {
    set({ currentSessionId: id, sessionSummary: null });
    if (id) {
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

  createSession: async ({ workspaceId, goal, branchPrefix, providerPreference }) => {
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

  sendTurn: async ({ sessionId, content }) => {
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
    const provider = session.providerPreference.defaultProvider;
    const model = session.providerPreference.defaultModel ?? getDefaultTurnModel(provider);

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

    const userMessage: Message = {
      id: crypto.randomUUID() as MessageId,
      sessionId,
      role: 'user',
      content,
      createdAt: now(),
    };
    await insertMessage(tauriDatabase, userMessage);

    const runId = crypto.randomUUID() as ProviderRunId;
    const run: ProviderRun = {
      id: runId,
      sessionId,
      provider,
      model,
      status: { kind: 'streaming', startedAt: now() },
      createdAt: now(),
    };
    await insertProviderRun(tauriDatabase, run);

    let nextState: SessionState = session.state;
    if (nextState.kind === 'draft') {
      nextState = sessionReducer(nextState, { kind: 'start', at: now() });
    }
    nextState = sessionReducer(nextState, { kind: 'send', runId, at: now() });
    await updateSessionState(tauriDatabase, sessionId, nextState, now());
    applySessionUpdate(set, sessionId, nextState);

    let assistantText = '';
    let lastError: unknown = null;

    try {
      for await (const event of runTurn({
        runId,
        model,
        workingDir,
        prompt: content,
      })) {
        get().appendTurnEvent(sessionId, event);
        if (event.kind === 'assistant_text') assistantText += event.delta;

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
            const [sessSummary, wsSummary] = await Promise.all([
              summarizeSessionTelemetry(tauriDatabase, sessionId),
              summarizeWorkspaceTelemetry(tauriDatabase, session.workspaceId),
            ]);
            set({ sessionSummary: sessSummary, workspaceSummary: wsSummary });
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
      const apiKey = await getSecret(ANTHROPIC_API_KEY_SECRET);
      if (apiKey) {
        void runSummarizer(set, get, sessionId, content, assistantText, apiKey);
      }
    }

    if (lastError) throw lastError;
  },

  cancelCurrentTurn: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.state.kind !== 'running') return;
    await cancelTurn(session.state.runId);
  },

  refreshWorkspaceSummary: async (workspaceId) => {
    const summary = await summarizeWorkspaceTelemetry(tauriDatabase, workspaceId);
    set({ workspaceSummary: summary });
  },

  loadSessionTelemetry: async (sessionId) => {
    const records = await listTelemetryForSession(tauriDatabase, sessionId);
    set((state) => ({
      sessionTelemetry: { ...state.sessionTelemetry, [sessionId]: records },
    }));
  },

  refreshApiKeyPresence: async () => {
    const present = await hasSecret(ANTHROPIC_API_KEY_SECRET);
    set({ apiKeyPresent: present });
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
}));
