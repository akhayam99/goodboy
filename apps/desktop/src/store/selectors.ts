import { useEffect, useMemo, useState } from 'react';
import { worktreeChangedFiles } from '../features/worktree/worktree';
import type {
  Agent,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  OpenQuestion,
  PlanWithCount,
  Session,
  SessionId,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import type { Workspace } from '@goodboy/types';
import type { NextAction } from '@goodboy/core';
import {
  useAppStore,
  type AppState,
  type SessionLoadingFlags,
  type SummarizerSessionStatus,
} from './store';
import { sortAndGroupSessions, type GroupedSessions } from './slices/session-view.slice';

export type { GroupedSessions };

const DEFAULT_SESSION_VIEW_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'none' };

export function useSessionViewPrefs(workspaceId: WorkspaceId | null): SessionViewPrefs {
  const prefs = useAppStore((s) =>
    workspaceId ? (s.sessionViewPrefs[workspaceId] ?? null) : null,
  );
  const getSessionViewPrefs = useAppStore((s) => s.getSessionViewPrefs);

  useEffect(() => {
    if (workspaceId && prefs === null) {
      getSessionViewPrefs(workspaceId);
    }
  }, [workspaceId, prefs, getSessionViewPrefs]);

  return prefs ?? DEFAULT_SESSION_VIEW_PREFS;
}

const EMPTY_GITHUB_STATE: Readonly<Record<string, never>> = Object.freeze({});

export function useSortedGroupedSessions(
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): ReadonlyArray<GroupedSessions> {
  const prefs = useSessionViewPrefs(workspaceId);
  const needsGithub = prefs.group === 'pr';
  // Only subscribe to the full github map when we actually group by PR.
  // Otherwise any PR poll for any session would invalidate the memo and
  // force a re-sort of every sidebar in the app.
  const sessionGithub = useAppStore((s) =>
    needsGithub ? s.sessionGithub : (EMPTY_GITHUB_STATE as typeof s.sessionGithub),
  );
  return useMemo(
    () => sortAndGroupSessions(sessions, prefs, sessionGithub),
    [sessions, prefs, sessionGithub],
  );
}

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

const selectWorkspaces = (state: AppState): ReadonlyArray<Workspace> => state.workspaces;
const selectCurrentWorkspace = (state: AppState): Workspace | null =>
  state.workspaces.find((w) => w.id === state.currentWorkspaceId) ?? null;
const selectSessions = (state: AppState): ReadonlyArray<Session> => state.sessions;

// Archived sessions are not in `state.sessions` by construction — they live
// in `state.archivedSessions[workspaceId]` and are loaded lazily. Lookups for
// the current session / a specific id need to fall back into that pool so the
// detail panel and SessionSettingsDialog work when the user clicks an
// archived row in the Archived tab.
function findSessionInAnyPool(state: AppState, id: string | null): Session | null {
  if (!id) return null;
  const active = state.sessions.find((s) => s.id === id);
  if (active) return active;
  for (const list of Object.values(state.archivedSessions)) {
    const hit = list.find((s) => s.id === id);
    if (hit) return hit;
  }
  return null;
}

const selectCurrentSession = (state: AppState): Session | null =>
  findSessionInAnyPool(state, state.currentSessionId);
export const useWorkspaces = (): ReadonlyArray<Workspace> => useAppStore(selectWorkspaces);
export const useCurrentWorkspace = (): Workspace | null => useAppStore(selectCurrentWorkspace);
export const useSessions = (): ReadonlyArray<Session> => useAppStore(selectSessions);
export const useCurrentSession = (): Session | null => useAppStore(selectCurrentSession);

export const useSessionById = (id: SessionId | null): Session | null => {
  const selector = useMemo(
    () =>
      (state: AppState): Session | null =>
        findSessionInAnyPool(state, id),
    [id],
  );
  return useAppStore(selector);
};

const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];

export const useSessionSlots = (sessionId: SessionId | null): ReadonlyArray<ContextSlot> =>
  useAppStore((s) => (sessionId ? (s.sessionSlots[sessionId] ?? EMPTY_SLOTS) : EMPTY_SLOTS));

const EMPTY_OPEN_QUESTIONS: ReadonlyArray<OpenQuestion> = [];

export const useSessionOpenQuestions = (sessionId: SessionId | null): ReadonlyArray<OpenQuestion> =>
  useAppStore((s) =>
    sessionId ? (s.sessionOpenQuestions[sessionId] ?? EMPTY_OPEN_QUESTIONS) : EMPTY_OPEN_QUESTIONS,
  );

const IDLE_STATUS: SummarizerSessionStatus = {
  status: 'idle',
  lastUpdate: null,
  error: null,
  lastUsage: null,
  lastAttempt: null,
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
  readonly additions: number;
  readonly deletions: number;
}

const EMPTY_FILES_TOUCHED: FilesTouched = { paths: [], count: 0, additions: 0, deletions: 0 };

/**
 * Files that differ between the session worktree and its base branch
 * (`main`/`master`, or their `origin/` counterparts — first existing wins).
 * Includes uncommitted + untracked changes. Stable across pushes: pushing
 * commits doesn't drop the count because the diff is computed against the
 * merge-base with the base branch, not against `HEAD`.
 *
 * Refresh triggers: session switch, summarizer ticks, and the max
 * `lastFinishedAt` across the session's agents. We avoid keying on
 * transcript length — that grows token-by-token and would re-fire the
 * Tauri invoke on every streamed chunk.
 */
export const useFilesTouched = (
  sessionId: SessionId | null,
  isActive: boolean = true,
): FilesTouched => {
  const workingDir = useAppStore((s) =>
    sessionId ? ((s.sessionWorktrees[sessionId] ?? [])[0] ?? null) : null,
  );
  const lastTurnFinishedAt = useAppStore((s) => {
    if (!sessionId) return null;
    const runs = s.sessionPhaseRuns[sessionId];
    if (!runs) return null;
    let max: string | null = null;
    for (const run of runs) {
      const t = run.lastFinishedAt ?? null;
      if (t && (max === null || t > max)) max = t;
    }
    return max;
  });
  const summarizerLastUpdate = useAppStore((s) =>
    sessionId ? (s.summarizerStatus[sessionId]?.lastUpdate ?? null) : null,
  );

  const [state, setState] = useState<FilesTouched>(EMPTY_FILES_TOUCHED);

  // Keep-alive panels stay mounted but hidden behind the active session.
  // Without the `isActive` gate, every summarizer tick on a hidden session
  // re-fires `worktreeChangedFiles` (4 git subprocesses + per-untracked
  // `fs::read_to_string`). With 5 keep-alive ContextPanels this piles up
  // 15+ concurrent git invocations during heavy streaming.
  useEffect(() => {
    if (!isActive || !workingDir) {
      if (!workingDir) setState(EMPTY_FILES_TOUCHED);
      return;
    }
    let cancelled = false;
    worktreeChangedFiles(workingDir)
      .then((summary) => {
        if (cancelled) return;
        setState(
          summary.paths.length === 0
            ? EMPTY_FILES_TOUCHED
            : {
                paths: summary.paths,
                count: summary.paths.length,
                additions: summary.additions,
                deletions: summary.deletions,
              },
        );
      })
      .catch(() => {
        if (!cancelled) setState(EMPTY_FILES_TOUCHED);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, workingDir, lastTurnFinishedAt, summarizerLastUpdate]);

  return state;
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
