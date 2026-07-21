import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { worktreeChangedFiles } from '../features/worktree/worktree';
import {
  classifyAgent,
  selectNonResolverStandaloneAgents,
  type AgentKind,
} from '../features/session/agent-kind';
import type {
  Agent,
  ContextSlot,
  ContextSlotHistoryEntry,
  DiffComment,
  OpenQuestion,
  PlanWithCount,
  Session,
  SessionId,
  SessionStage,
  SessionStageInfo,
  SessionViewPrefs,
  TelemetryRecord,
  WorkspaceId,
} from '@goodboy/types';
import type { Workspace } from '@goodboy/types';
import {
  useAppStore,
  type AppState,
  type SessionLoadingFlags,
  type SummarizerSessionStatus,
} from './store';
import {
  deriveSessionStage,
  sortAndGroupSessions,
  type GroupedSessions,
} from './slices/session-view';

const DEFAULT_SESSION_VIEW_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };
const EMPTY_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];

export const sumSessionCost = (records: readonly TelemetryRecord[]): number => {
  let sum = 0;
  for (const record of records) {
    if (record.kind === 'summarizer') {
      continue;
    }
    sum += record.estimatedCostUsd;
  }
  return sum;
};

export const useSessionCost = (sessionId: SessionId): number => {
  const records = useAppStore((state) => state.sessionTelemetry[sessionId] ?? EMPTY_TELEMETRY);
  return useMemo(() => sumSessionCost(records), [records]);
};

export const useSessionViewPrefs = (workspaceId: WorkspaceId | null): SessionViewPrefs => {
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
};

const EMPTY_GITHUB_STATE: Readonly<Record<string, never>> = Object.freeze({});

function countOpenQuestions(state: AppState, sessionId: SessionId): number {
  const questions = state.sessionOpenQuestions[sessionId];
  if (!questions) {
    return 0;
  }
  return questions.filter((q) => q.status === 'open').length;
}

function sessionHasUnreadIn(state: AppState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  if (!runs) {
    return false;
  }
  const selected = state.selectedAgentId[sessionId] ?? null;
  const isCurrent = state.currentSessionId === sessionId;
  return runs.some((r) => agentHasUnread(r, isCurrent && r.id === selected));
}

function sessionHasRunningAgentIn(state: AppState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  return runs ? runs.some((r) => r.status === 'running') : false;
}

function stageInfoOf(state: AppState, session: Session): SessionStageInfo {
  const sessionId = session.id as SessionId;
  return deriveSessionStage({
    session,
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    hasUnread: sessionHasUnreadIn(state, sessionId),
    openQuestionCount: countOpenQuestions(state, sessionId),
    hasRunningAgent: sessionHasRunningAgentIn(state, sessionId),
  });
}

export const useSessionStageInfo = (session: Session): SessionStageInfo => {
  const stage = useAppStore((s) => stageInfoOf(s, session).stage);
  const reason = useAppStore((s) => stageInfoOf(s, session).reason);
  return useMemo(() => ({ stage, reason }), [stage, reason]);
};

export const useSortedGroupedSessions = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): ReadonlyArray<GroupedSessions> => {
  const prefs = useSessionViewPrefs(workspaceId);
  const needsGithub = prefs.group === 'pr' || prefs.group === 'stage';
  const needsStage = prefs.group === 'stage';
  const sessionGithub = useAppStore((s) =>
    needsGithub ? s.sessionGithub : (EMPTY_GITHUB_STATE as typeof s.sessionGithub),
  );
  const sessionOpenQuestions = useAppStore((s) =>
    needsStage ? s.sessionOpenQuestions : (EMPTY_GITHUB_STATE as typeof s.sessionOpenQuestions),
  );
  const sessionPhaseRuns = useAppStore((s) =>
    needsStage ? s.sessionPhaseRuns : (EMPTY_GITHUB_STATE as typeof s.sessionPhaseRuns),
  );
  const selectedAgentId = useAppStore((s) =>
    needsStage ? s.selectedAgentId : (EMPTY_GITHUB_STATE as typeof s.selectedAgentId),
  );
  const currentSessionId = useAppStore((s) => (needsStage ? s.currentSessionId : null));
  return useMemo(() => {
    const partial = {
      sessionGithub,
      sessionOpenQuestions,
      sessionPhaseRuns,
      selectedAgentId,
      currentSessionId,
    };
    const stages: Record<SessionId, SessionStage> = {};
    if (needsStage) {
      for (const session of sessions) {
        stages[session.id as SessionId] = stageInfoOf(partial as AppState, session).stage;
      }
    }
    return sortAndGroupSessions(sessions, prefs, sessionGithub, stages);
  }, [
    sessions,
    prefs,
    needsStage,
    sessionGithub,
    sessionOpenQuestions,
    sessionPhaseRuns,
    selectedAgentId,
    currentSessionId,
  ]);
};

export const useStageGroupedSessions = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): ReadonlyArray<GroupedSessions> => {
  const prefs = useSessionViewPrefs(workspaceId);
  const sessionGithub = useAppStore((s) => s.sessionGithub);
  const sessionOpenQuestions = useAppStore((s) => s.sessionOpenQuestions);
  const sessionPhaseRuns = useAppStore((s) => s.sessionPhaseRuns);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  return useMemo(() => {
    const partial = {
      sessionGithub,
      sessionOpenQuestions,
      sessionPhaseRuns,
      selectedAgentId,
      currentSessionId,
    };
    const stages: Record<SessionId, SessionStage> = {};
    for (const session of sessions) {
      stages[session.id as SessionId] = stageInfoOf(partial as AppState, session).stage;
    }
    return sortAndGroupSessions(
      sessions,
      { sort: prefs.sort, group: 'stage' },
      sessionGithub,
      stages,
    );
  }, [
    sessions,
    prefs.sort,
    sessionGithub,
    sessionOpenQuestions,
    sessionPhaseRuns,
    selectedAgentId,
    currentSessionId,
  ]);
};

export type WorkspaceRollup = {
  readonly attentionCount: number;
  readonly runningCount: number;
  readonly todaySpend: number;
};

export const useWorkspaceRollup = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): WorkspaceRollup => {
  const groups = useStageGroupedSessions(workspaceId, sessions);
  const sessionTelemetry = useAppStore((s) => s.sessionTelemetry);
  return useMemo(() => {
    const countOf = (key: string) => groups.find((g) => g.key === key)?.sessions.length ?? 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const cutoff = startOfDay.toISOString();
    let todaySpend = 0;
    for (const session of sessions) {
      const recs = sessionTelemetry[session.id as SessionId];
      if (!recs) {
        continue;
      }
      for (const rec of recs) {
        if (rec.kind === 'summarizer' || rec.recordedAt < cutoff) {
          continue;
        }
        todaySpend += rec.estimatedCostUsd;
      }
    }
    return {
      attentionCount: countOf('attention'),
      runningCount: countOf('running'),
      todaySpend,
    };
  }, [groups, sessionTelemetry, sessions]);
};

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

function findSessionInAnyPool(state: AppState, id: string | null): Session | null {
  if (!id) {
    return null;
  }
  const active = state.sessions.find((s) => s.id === id);
  if (active) {
    return active;
  }
  for (const list of Object.values(state.archivedSessions)) {
    const hit = list.find((s) => s.id === id);
    if (hit) {
      return hit;
    }
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

export const useSessionAnsweredQuestions = (
  sessionId: SessionId | null,
): ReadonlyArray<OpenQuestion> =>
  useAppStore((s) =>
    sessionId
      ? (s.sessionAnsweredQuestions[sessionId] ?? EMPTY_OPEN_QUESTIONS)
      : EMPTY_OPEN_QUESTIONS,
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

const EMPTY_COMMENTS: ReadonlyArray<DiffComment> = [];

export const useDiffComments = (sessionId: SessionId | null): ReadonlyArray<DiffComment> =>
  useAppStore((s) => (sessionId ? (s.diffComments[sessionId] ?? EMPTY_COMMENTS) : EMPTY_COMMENTS));

const EMPTY_PLANS: ReadonlyArray<PlanWithCount> = [];

export const useSessionPlans = (sessionId: SessionId | null): ReadonlyArray<PlanWithCount> =>
  useAppStore((s) => (sessionId ? (s.sessionPlans[sessionId] ?? EMPTY_PLANS) : EMPTY_PLANS));

export type FilesTouched = {
  readonly paths: ReadonlyArray<string>;
  readonly count: number;
  readonly additions: number;
  readonly deletions: number;
};

const EMPTY_FILES_TOUCHED: FilesTouched = { paths: [], count: 0, additions: 0, deletions: 0 };

export const useFilesTouched = (
  sessionId: SessionId | null,
  isActive: boolean = true,
): FilesTouched => {
  const workingDir = useAppStore((s) =>
    sessionId ? ((s.sessionWorktrees[sessionId] ?? [])[0] ?? null) : null,
  );
  const lastTurnFinishedAt = useAppStore((s) => {
    if (!sessionId) {
      return null;
    }
    const runs = s.sessionPhaseRuns[sessionId];
    if (!runs) {
      return null;
    }
    let max: string | null = null;
    for (const run of runs) {
      const t = run.lastFinishedAt ?? null;
      if (t && (max === null || t > max)) {
        max = t;
      }
    }
    return max;
  });
  const summarizerLastUpdate = useAppStore((s) =>
    sessionId ? (s.summarizerStatus[sessionId]?.lastUpdate ?? null) : null,
  );

  const [state, setState] = useState<FilesTouched>(EMPTY_FILES_TOUCHED);

  useEffect(() => {
    if (!isActive || !workingDir) {
      if (!workingDir) {
        setState(EMPTY_FILES_TOUCHED);
      }
      return;
    }
    let cancelled = false;
    worktreeChangedFiles(workingDir)
      .then((summary) => {
        if (cancelled) {
          return;
        }
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
        if (!cancelled) {
          setState(EMPTY_FILES_TOUCHED);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, workingDir, lastTurnFinishedAt, summarizerLastUpdate]);

  return state;
};

export const agentHasUnread = (agent: Agent, isCurrentlyViewed: boolean): boolean => {
  if (isCurrentlyViewed) {
    return false;
  }
  if (agent.status === 'skipped') {
    return false;
  }
  if (!agent.lastFinishedAt) {
    return false;
  }
  if (!agent.lastViewedAt) {
    return true;
  }
  return agent.lastFinishedAt > agent.lastViewedAt;
};

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];

const useSessionAgentKindOverrides = (sessionId: SessionId): Readonly<Record<string, AgentKind>> =>
  useAppStore(
    useShallow((state) => {
      const overrides: Record<string, AgentKind> = {};
      for (const agent of state.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS) {
        const override = state.agentKindOverride[agent.id];
        if (override != null) {
          overrides[agent.id] = override;
        }
      }
      return overrides;
    }),
  );

export const useNonResolverStandaloneAgents = (sessionId: SessionId): ReadonlyArray<Agent> => {
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const agentKindOverride = useSessionAgentKindOverrides(sessionId);
  return useMemo(
    () => selectNonResolverStandaloneAgents(phaseRuns, agentKindOverride),
    [phaseRuns, agentKindOverride],
  );
};

export type SessionUnreadLens = 'agents' | 'resolve' | 'workflows' | null;

export const useSessionUnreadLens = (sessionId: SessionId): SessionUnreadLens => {
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[sessionId] ?? null);
  const isCurrentSession = useAppStore((s) => s.currentSessionId === sessionId);
  const agentKindOverride = useSessionAgentKindOverrides(sessionId);
  return useMemo(() => {
    let unreadAgent: Agent | null = null;
    for (const agent of phaseRuns) {
      if (!agentHasUnread(agent, isCurrentSession && agent.id === selectedAgentId)) {
        continue;
      }
      if (
        unreadAgent != null &&
        (agent.lastFinishedAt ?? '') <= (unreadAgent.lastFinishedAt ?? '')
      ) {
        continue;
      }
      unreadAgent = agent;
    }
    if (unreadAgent == null) {
      return null;
    }
    if (unreadAgent.workflowRunId != null && unreadAgent.stepId != null) {
      return 'workflows';
    }
    if (classifyAgent(unreadAgent, agentKindOverride[unreadAgent.id] ?? null) === 'resolver') {
      return 'resolve';
    }
    return 'agents';
  }, [phaseRuns, selectedAgentId, isCurrentSession, agentKindOverride]);
};

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
    if (!phaseRuns) {
      return false;
    }
    return phaseRuns.some((r) => agentHasUnread(r, isCurrentSession && r.id === selectedAgentId));
  }, [phaseRuns, selectedAgentId, isCurrentSession]);
};

export const useWorkspaceHasUnread = (workspaceId: WorkspaceId | null): boolean =>
  useAppStore((s) => (workspaceId ? s.unreadWorkspaceIds.has(workspaceId) : false));

export const useHasUnreadElsewhere = (currentId: WorkspaceId | null): boolean => {
  const unread = useAppStore((s) => s.unreadWorkspaceIds);
  const presence = useAppStore((s) => s.windowPresence);
  return useMemo(() => {
    const shown = new Set<WorkspaceId>();
    for (const ws of Object.values(presence))
      if (ws) {
        shown.add(ws);
      }
    for (const id of unread)
      if (id !== currentId && !shown.has(id)) {
        return true;
      }
    return false;
  }, [unread, presence, currentId]);
};
