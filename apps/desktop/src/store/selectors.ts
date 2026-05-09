import type { ContextSlot, ContextSlotHistoryEntry, Task, TaskId, Workspace } from '@kay-am/types';
import { useAppStore, type AppState, type SummarizerSessionStatus } from './store';

export const selectWorkspaces = (state: AppState): ReadonlyArray<Workspace> => state.workspaces;
export const selectCurrentWorkspace = (state: AppState): Workspace | null =>
  state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
export const selectSessions = (state: AppState): ReadonlyArray<Task> => state.sessions;
export const selectCurrentSession = (state: AppState): Task | null =>
  state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
export const useWorkspaces = (): ReadonlyArray<Workspace> => useAppStore(selectWorkspaces);
export const useCurrentWorkspace = (): Workspace | null => useAppStore(selectCurrentWorkspace);
export const useSessions = (): ReadonlyArray<Task> => useAppStore(selectSessions);
export const useCurrentSession = (): Task | null => useAppStore(selectCurrentSession);

const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];

export const useSessionSlots = (taskId: TaskId | null): ReadonlyArray<ContextSlot> =>
  useAppStore((s) => (taskId ? (s.sessionSlots[taskId] ?? EMPTY_SLOTS) : EMPTY_SLOTS));

const IDLE_STATUS: SummarizerSessionStatus = { status: 'idle', lastUpdate: null, error: null };

export const useSummarizerStatus = (taskId: TaskId | null): SummarizerSessionStatus =>
  useAppStore((s) => (taskId ? (s.summarizerStatus[taskId] ?? IDLE_STATUS) : IDLE_STATUS));

const EMPTY_HISTORY: ReadonlyArray<ContextSlotHistoryEntry> = [];

export const useSlotHistory = (
  taskId: TaskId | null,
  key: string,
): ReadonlyArray<ContextSlotHistoryEntry> =>
  useAppStore((s) => (taskId ? (s.slotHistory[taskId]?.[key] ?? EMPTY_HISTORY) : EMPTY_HISTORY));
