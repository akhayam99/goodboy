import { useMemo } from 'react';
import type {
  Agent,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  PlanWithCount,
  Session,
  SessionId,
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

export const useSessionLoading = (sessionId: SessionId | null): SessionLoadingFlags =>
  useAppStore((s) => (sessionId ? (s.sessionLoading[sessionId] ?? NO_LOADING) : NO_LOADING));

function toRelPath(absPath: string, workingDir: string | null): string {
  if (!workingDir) return absPath;
  const root = workingDir.endsWith('/') ? workingDir : `${workingDir}/`;
  return absPath.startsWith(root) ? absPath.slice(root.length) : absPath;
}

const selectWorkspaces = (state: AppState): ReadonlyArray<Workspace> => state.workspaces;
const selectCurrentWorkspace = (state: AppState): Workspace | null =>
  state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
const selectSessions = (state: AppState): ReadonlyArray<Session> => state.sessions;
const selectCurrentSession = (state: AppState): Session | null =>
  state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
export const useWorkspaces = (): ReadonlyArray<Workspace> => useAppStore(selectWorkspaces);
export const useCurrentWorkspace = (): Workspace | null => useAppStore(selectCurrentWorkspace);
export const useSessions = (): ReadonlyArray<Session> => useAppStore(selectSessions);
export const useCurrentSession = (): Session | null => useAppStore(selectCurrentSession);

export const useSessionById = (id: SessionId | null): Session | null => {
  const selector = useMemo(
    () =>
      (state: AppState): Session | null =>
        id ? (state.sessions.find((s) => s.id === id) ?? null) : null,
    [id],
  );
  return useAppStore(selector);
};

const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];

export const useSessionSlots = (sessionId: SessionId | null): ReadonlyArray<ContextSlot> =>
  useAppStore((s) => (sessionId ? (s.sessionSlots[sessionId] ?? EMPTY_SLOTS) : EMPTY_SLOTS));

const IDLE_STATUS: SummarizerSessionStatus = {
  status: 'idle',
  lastUpdate: null,
  error: null,
  lastUsage: null,
};

export const useSummarizerStatus = (sessionId: SessionId | null): SummarizerSessionStatus =>
  useAppStore((s) => (sessionId ? (s.summarizerStatus[sessionId] ?? IDLE_STATUS) : IDLE_STATUS));

const EMPTY_HISTORY: ReadonlyArray<ContextSlotHistoryEntry> = [];

export const useSlotHistory = (
  sessionId: SessionId | null,
  key: string,
): ReadonlyArray<ContextSlotHistoryEntry> =>
  useAppStore((s) =>
    sessionId ? (s.slotHistory[sessionId]?.[key] ?? EMPTY_HISTORY) : EMPTY_HISTORY,
  );

const EMPTY_NEXT_ACTIONS: ReadonlyArray<NextAction> = [];

export const useSessionNextActions = (sessionId: SessionId | null): ReadonlyArray<NextAction> =>
  useAppStore((s) =>
    sessionId ? (s.sessionNextActions[sessionId] ?? EMPTY_NEXT_ACTIONS) : EMPTY_NEXT_ACTIONS,
  );

const EMPTY_COMMENTS: ReadonlyArray<DiffComment> = [];

export const useDiffComments = (sessionId: SessionId | null): ReadonlyArray<DiffComment> =>
  useAppStore((s) => (sessionId ? (s.diffComments[sessionId] ?? EMPTY_COMMENTS) : EMPTY_COMMENTS));

const EMPTY_PLANS: ReadonlyArray<PlanWithCount> = [];

export const useSessionPlans = (sessionId: SessionId | null): ReadonlyArray<PlanWithCount> =>
  useAppStore((s) => (sessionId ? (s.sessionPlans[sessionId] ?? EMPTY_PLANS) : EMPTY_PLANS));

export const useMostRecentPlan = (sessionId: SessionId | null): PlanWithCount | null => {
  const plans = useSessionPlans(sessionId);
  return plans[plans.length - 1] ?? null;
};

interface FilesTouched {
  readonly paths: ReadonlyArray<string>;
  readonly count: number;
}

const EMPTY_FILES_TOUCHED: FilesTouched = { paths: [], count: 0 };

/**
 * Distinct files edited across every agent of a session, derived from `file_edit`
 * transcript events. Slot-based 'files_touched' lags until the summarizer
 * runs — this gives a live count regardless of summarizer state.
 *
 * Selectors return raw slices so Zustand's Object.is check is stable; the
 * derived list is memoized in React.
 */
export const useFilesTouched = (sessionId: SessionId | null): FilesTouched => {
  const phaseRuns = useAppStore((s) =>
    sessionId ? (s.sessionPhaseRuns[sessionId] ?? null) : null,
  );
  const transcripts = useAppStore((s) => s.transcripts);
  const workingDir = useAppStore((s) =>
    sessionId ? ((s.sessionWorktrees[sessionId] ?? [])[0] ?? null) : null,
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
 * this agent right now (i.e. agent is selected in its session AND its session is the
 * active session). Being merely "selected" in a non-active session does not count —
 * the user is elsewhere.
 */
export const agentHasUnread = (agent: Agent, isCurrentlyViewed: boolean): boolean => {
  if (isCurrentlyViewed) return false;
  if (!agent.lastFinishedAt) return false;
  if (!agent.lastViewedAt) return true;
  return agent.lastFinishedAt > agent.lastViewedAt;
};

/**
 * Returns true if any child agent of the session has an unread terminal response.
 * Excludes the agent the user is currently viewing (selected + session active).
 */
export const useSessionHasUnread = (sessionId: SessionId | null): boolean => {
  const phaseRuns = useAppStore((s) =>
    sessionId ? (s.sessionPhaseRuns[sessionId] ?? null) : null,
  );
  const selectedAgentId = useAppStore((s) =>
    sessionId ? (s.selectedAgentId[sessionId] ?? null) : null,
  );
  const isCurrentSession = useAppStore(
    (s) => sessionId !== null && s.currentSessionId === sessionId,
  );
  return useMemo(() => {
    if (!phaseRuns) return false;
    return phaseRuns.some((r) => agentHasUnread(r, isCurrentSession && r.id === selectedAgentId));
  }, [phaseRuns, selectedAgentId, isCurrentSession]);
};

/**
 * Workspace bubbles up: true if any of its tasks contain an unread agent.
 * Backed by `unreadWorkspaceIds`, a DB-aggregated set so the dot can pulse
 * even on workspaces whose tasks aren't loaded in memory (the user is
 * currently on a different workspace).
 */
export const useWorkspaceHasUnread = (workspaceId: WorkspaceId | null): boolean =>
  useAppStore((s) => (workspaceId ? s.unreadWorkspaceIds.has(workspaceId) : false));
