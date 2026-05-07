import { create } from 'zustand';
import {
  getSetting,
  listSessionsForWorkspace,
  listWorkspaces,
  setSetting as dbSetSetting,
  summarizeSessionTelemetry,
  type TelemetrySummary,
} from '@kay-am/db';
import type { Session, SessionId, Workspace, WorkspaceId } from '@kay-am/types';
import { runDbMigrations, tauriDatabase } from '../db';
import { getProviderStatus, type ProviderStatus } from '../providers';

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
};

export const useAppStore = create<AppStore>((set) => ({
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
      const summary = await summarizeSessionTelemetry(tauriDatabase, id);
      set({ sessionSummary: summary });
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
}));
