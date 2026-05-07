import type { ContextSlot, Session, SessionId, Workspace } from '@kay-am/types';
import { useAppStore, type AppState } from './store';

export const selectWorkspaces = (state: AppState): ReadonlyArray<Workspace> => state.workspaces;
export const selectCurrentWorkspace = (state: AppState): Workspace | null =>
  state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
export const selectSessions = (state: AppState): ReadonlyArray<Session> => state.sessions;
export const selectCurrentSession = (state: AppState): Session | null =>
  state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
export const selectProviderAvailable = (state: AppState): boolean =>
  state.providerStatus?.available === true;

export const useWorkspaces = (): ReadonlyArray<Workspace> => useAppStore(selectWorkspaces);
export const useCurrentWorkspace = (): Workspace | null => useAppStore(selectCurrentWorkspace);
export const useSessions = (): ReadonlyArray<Session> => useAppStore(selectSessions);
export const useCurrentSession = (): Session | null => useAppStore(selectCurrentSession);
export const useProviderAvailable = (): boolean => useAppStore(selectProviderAvailable);

const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];

export const useSessionSlots = (sessionId: SessionId | null): ReadonlyArray<ContextSlot> =>
  useAppStore((s) => (sessionId ? (s.sessionSlots[sessionId] ?? EMPTY_SLOTS) : EMPTY_SLOTS));
