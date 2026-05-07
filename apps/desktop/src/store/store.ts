import { create } from 'zustand';
import { sessionReducer } from '@kay-am/core';
import {
  getSetting,
  insertMessage,
  insertProviderRun,
  insertSession,
  insertWorkspace,
  listMessagesForSession,
  listSessionsForWorkspace,
  listWorkspaces,
  setSetting as dbSetSetting,
  summarizeSessionTelemetry,
  updateProviderRunStatus,
  updateSessionState,
  type TelemetrySummary,
} from '@kay-am/db';
import type {
  IsoDateTime,
  Message,
  MessageId,
  ProviderRun,
  ProviderRunId,
  Session,
  SessionId,
  SessionState,
  TurnEvent,
  Workspace,
  WorkspaceId,
} from '@kay-am/types';
import { runDbMigrations, tauriDatabase } from '../db';
import { getProviderStatus, type ProviderStatus } from '../providers';
import { validateGitRepo } from '../repo';
import { runTurn, cancelTurn } from '../turn';
import { createWorktree, type CreatedWorktree } from '../worktree';

export interface AppState {
  readonly workspaces: ReadonlyArray<Workspace>;
  readonly currentWorkspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Session>;
  readonly currentSessionId: SessionId | null;
  readonly settings: Readonly<Record<string, string>>;
  readonly sessionSummary: TelemetrySummary | null;
  readonly providerStatus: ProviderStatus | null;
  readonly hydrated: boolean;
  readonly error: string | null;
  readonly transcripts: Readonly<Record<string, ReadonlyArray<TurnEvent>>>;
  readonly messages: Readonly<Record<string, ReadonlyArray<Message>>>;
  readonly sessionWorktrees: Readonly<Record<string, string>>;
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
  addWorkspace(input: { rootPath: string; name?: string }): Promise<Workspace>;
  createSession(input: {
    workspaceId: WorkspaceId;
    goal: string;
    branchPrefix?: string;
  }): Promise<{ session: Session; worktree: CreatedWorktree }>;
  loadTranscript(sessionId: SessionId): Promise<void>;
  appendTurnEvent(sessionId: SessionId, event: TurnEvent): void;
  resetTranscript(sessionId: SessionId): void;
  sendTurn(input: { sessionId: SessionId; content: string }): Promise<void>;
  cancelCurrentTurn(sessionId: SessionId): Promise<void>;
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
  hydrated: false,
  error: null,
  transcripts: {},
  messages: {},
  sessionWorktrees: {},
};

function messageToTurnEvent(message: Message): TurnEvent | null {
  if (message.role !== 'assistant') return null;
  return {
    kind: 'assistant_text',
    runId: 'history' as ProviderRunId,
    delta: message.content,
    at: message.createdAt,
  };
}

const DEFAULT_MODEL = 'claude-opus-4-7';

type SetFn = (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void;

function applySessionUpdate(set: SetFn, sessionId: SessionId, state: SessionState): void {
  set((store) => ({
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, state, updatedAt: new Date().toISOString() as IsoDateTime } : s,
    ),
  }));
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  hydrate: async () => {
    try {
      await runDbMigrations();
      const [workspaces, providerStatus] = await Promise.all([
        listWorkspaces(tauriDatabase),
        getProviderStatus(),
      ]);
      set({ workspaces, providerStatus, hydrated: true, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), hydrated: true });
    }
  },

  setCurrentWorkspace: async (id) => {
    set({
      currentWorkspaceId: id,
      currentSessionId: null,
      sessions: [],
      sessionSummary: null,
    });
    if (id) {
      const sessions = await listSessionsForWorkspace(tauriDatabase, id);
      set({ sessions });
    }
  },

  setCurrentSession: async (id) => {
    set({ currentSessionId: id, sessionSummary: null });
    if (id) {
      const messages = await listMessagesForSession(tauriDatabase, id);
      const events = messages.map(messageToTurnEvent).filter((e): e is TurnEvent => e !== null);
      const summary = await summarizeSessionTelemetry(tauriDatabase, id);
      set((state) => ({
        sessionSummary: summary,
        messages: { ...state.messages, [id]: messages },
        transcripts: { ...state.transcripts, [id]: events },
      }));
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
    set({ providerStatus: status });
  },

  createSession: async ({ workspaceId, goal, branchPrefix }) => {
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
      provider: 'anthropic',
      model: DEFAULT_MODEL,
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
        model: DEFAULT_MODEL,
        workingDir,
        prompt: content,
      })) {
        get().appendTurnEvent(sessionId, event);
        if (event.kind === 'assistant_text') assistantText += event.delta;

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
      const message = err instanceof Error ? err.message : String(err);
      const errorState: SessionState = {
        kind: 'error',
        message,
        failedAt: now(),
      };
      await updateSessionState(tauriDatabase, sessionId, errorState, now());
      applySessionUpdate(set, sessionId, errorState);
      await updateProviderRunStatus(tauriDatabase, runId, {
        kind: 'failed',
        finishedAt: now(),
        error: message,
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

    if (lastError) throw lastError;
  },

  cancelCurrentTurn: async (sessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session || session.state.kind !== 'running') return;
    await cancelTurn(session.state.runId);
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
