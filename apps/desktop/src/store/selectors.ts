import { useMemo } from 'react';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  Task,
  TaskId,
} from '@kay-am/types';
import type { Workspace } from '@kay-am/types';
import type { NextAction } from '@kay-am/core';
import { useAppStore, type AppState, type SummarizerSessionStatus } from './store';

function toRelPath(absPath: string, workingDir: string | null): string {
  if (!workingDir) return absPath;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  return absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
}

const selectWorkspaces = (state: AppState): ReadonlyArray<Workspace> => state.workspaces;
const selectCurrentWorkspace = (state: AppState): Workspace | null =>
  state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
const selectSessions = (state: AppState): ReadonlyArray<Task> => state.sessions;
const selectCurrentSession = (state: AppState): Task | null =>
  state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
export const useWorkspaces = (): ReadonlyArray<Workspace> => useAppStore(selectWorkspaces);
export const useCurrentWorkspace = (): Workspace | null => useAppStore(selectCurrentWorkspace);
export const useSessions = (): ReadonlyArray<Task> => useAppStore(selectSessions);
export const useCurrentSession = (): Task | null => useAppStore(selectCurrentSession);

const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];

export const useSessionSlots = (taskId: TaskId | null): ReadonlyArray<ContextSlot> =>
  useAppStore((s) => (taskId ? (s.sessionSlots[taskId] ?? EMPTY_SLOTS) : EMPTY_SLOTS));

const IDLE_STATUS: SummarizerSessionStatus = {
  status: 'idle',
  lastUpdate: null,
  error: null,
  lastUsage: null,
};

export const useSummarizerStatus = (taskId: TaskId | null): SummarizerSessionStatus =>
  useAppStore((s) => (taskId ? (s.summarizerStatus[taskId] ?? IDLE_STATUS) : IDLE_STATUS));

const EMPTY_HISTORY: ReadonlyArray<ContextSlotHistoryEntry> = [];

export const useSlotHistory = (
  taskId: TaskId | null,
  key: string,
): ReadonlyArray<ContextSlotHistoryEntry> =>
  useAppStore((s) => (taskId ? (s.slotHistory[taskId]?.[key] ?? EMPTY_HISTORY) : EMPTY_HISTORY));

const EMPTY_NEXT_ACTIONS: ReadonlyArray<NextAction> = [];

export const useSessionNextActions = (taskId: TaskId | null): ReadonlyArray<NextAction> =>
  useAppStore((s) =>
    taskId ? (s.sessionNextActions[taskId] ?? EMPTY_NEXT_ACTIONS) : EMPTY_NEXT_ACTIONS,
  );

const EMPTY_COMMENTS: ReadonlyArray<DiffComment> = [];

export const useDiffComments = (taskId: TaskId | null): ReadonlyArray<DiffComment> =>
  useAppStore((s) => (taskId ? (s.diffComments[taskId] ?? EMPTY_COMMENTS) : EMPTY_COMMENTS));

interface FilesTouched {
  readonly paths: ReadonlyArray<string>;
  readonly count: number;
}

const EMPTY_FILES_TOUCHED: FilesTouched = { paths: [], count: 0 };

/**
 * Distinct files edited across every agent of a task, derived from `file_edit`
 * transcript events. Slot-based 'files_touched' lags until the summarizer
 * runs — this gives a live count regardless of summarizer state.
 *
 * Selectors return raw slices so Zustand's Object.is check is stable; the
 * derived list is memoized in React.
 */
export const useFilesTouched = (taskId: TaskId | null): FilesTouched => {
  const phaseRuns = useAppStore((s) => (taskId ? (s.sessionPhaseRuns[taskId] ?? null) : null));
  const transcripts = useAppStore((s) => s.transcripts);
  const workingDir = useAppStore((s) =>
    taskId ? ((s.sessionWorktrees[taskId] ?? [])[0] ?? null) : null,
  );
  return useMemo(() => {
    if (!phaseRuns || phaseRuns.length === 0) return EMPTY_FILES_TOUCHED;
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const run of phaseRuns) {
      const events = transcripts[run.id] ?? [];
      for (const ev of events) {
        if (ev.kind !== 'file_edit') continue;
        const rel = toRelPath(ev.path, workingDir);
        if (seen.has(rel)) continue;
        seen.add(rel);
        ordered.push(rel);
      }
    }
    if (ordered.length === 0) return EMPTY_FILES_TOUCHED;
    return { paths: ordered, count: ordered.length };
  }, [phaseRuns, transcripts, workingDir]);
};
