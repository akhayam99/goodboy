import { useMemo } from 'react';
import type {
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  PlanWithCount,
  Session,
  Task,
  TaskId,
  WorkspaceId,
} from '@kay-am/types';
import type { Workspace } from '@kay-am/types';
import type { NextAction } from '@kay-am/core';
import {
  useAppStore,
  type AppState,
  type SessionLoadingFlags,
  type SummarizerSessionStatus,
} from './store';

const NO_LOADING: SessionLoadingFlags = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

export const useSessionLoading = (taskId: TaskId | null): SessionLoadingFlags =>
  useAppStore((s) => (taskId ? (s.sessionLoading[taskId] ?? NO_LOADING) : NO_LOADING));

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

export const useSessionById = (id: TaskId | null): Task | null => {
  const selector = useMemo(
    () =>
      (state: AppState): Task | null =>
        id ? (state.sessions.find((s) => s.id === id) ?? null) : null,
    [id],
  );
  return useAppStore(selector);
};

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

const EMPTY_PLANS: ReadonlyArray<PlanWithCount> = [];

export const useSessionPlans = (taskId: TaskId | null): ReadonlyArray<PlanWithCount> =>
  useAppStore((s) => (taskId ? (s.sessionPlans[taskId] ?? EMPTY_PLANS) : EMPTY_PLANS));

export const useMostRecentPlan = (taskId: TaskId | null): PlanWithCount | null => {
  const plans = useSessionPlans(taskId);
  return plans[plans.length - 1] ?? null;
};

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

/**
 * Unread = agent finished a terminal turn after the user last viewed it.
 * `isCurrentlyViewed` must be true ONLY when the user is actively looking at
 * this agent right now (i.e. agent is selected in its task AND its task is the
 * active task). Being merely "selected" in a non-active task does not count —
 * the user is elsewhere.
 */
export const agentHasUnread = (agent: Session, isCurrentlyViewed: boolean): boolean => {
  if (isCurrentlyViewed) return false;
  if (!agent.lastFinishedAt) return false;
  if (!agent.lastViewedAt) return true;
  return agent.lastFinishedAt > agent.lastViewedAt;
};

/**
 * Returns true if any child agent of the task has an unread terminal response.
 * Excludes the agent the user is currently viewing (selected + task active).
 */
export const useTaskHasUnread = (taskId: TaskId | null): boolean => {
  const phaseRuns = useAppStore((s) => (taskId ? (s.sessionPhaseRuns[taskId] ?? null) : null));
  const selectedAgentId = useAppStore((s) => (taskId ? (s.selectedAgentId[taskId] ?? null) : null));
  const isCurrentTask = useAppStore((s) => taskId !== null && s.currentSessionId === taskId);
  return useMemo(() => {
    if (!phaseRuns) return false;
    return phaseRuns.some((r) => agentHasUnread(r, isCurrentTask && r.id === selectedAgentId));
  }, [phaseRuns, selectedAgentId, isCurrentTask]);
};

/**
 * Workspace bubbles up: true if any of its tasks contain an unread agent.
 * Backed by `unreadWorkspaceIds`, a DB-aggregated set so the dot can pulse
 * even on workspaces whose tasks aren't loaded in memory (the user is
 * currently on a different workspace).
 */
export const useWorkspaceHasUnread = (workspaceId: WorkspaceId | null): boolean =>
  useAppStore((s) => (workspaceId ? s.unreadWorkspaceIds.has(workspaceId) : false));
