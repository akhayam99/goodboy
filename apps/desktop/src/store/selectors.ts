import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { worktreeChangedFiles } from '../features/worktree/worktree';
import {
  agentHomeLens,
  classifyAgent,
  resolveRootAgent,
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
  SessionPrFetchState,
  SessionStage,
  SessionStageInfo,
  SessionViewPrefs,
  TelemetryRecord,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { Workspace } from '@goodboy/types';
import type { TerminalTab } from '../shared/types/terminal';
import { isBranchlessSession } from '../shared/utils/isBranchlessSession';
import { useAppStore } from './store';
import type { AppState, SessionLoadingFlags, SummarizerSessionStatus } from './types';
import {
  deriveSessionStage,
  isPrReviewSession,
  resolveSessionRequest,
  sortAndGroupSessions,
  type GroupedSessions,
} from './slices/session-view';
import { agentHasUnread } from './slices/agents/agentHasUnread';
import { sessionPrFetchState } from './slices/github/sessionPrFetchState';
import { isSessionPrFetchable } from './slices/github/resolveSessionPrFetch';
import { resolveSessionRepo } from './slices/worktrees/resolveSessionRepo';
import { runSpendUsd } from './slices/workflows/runSpendUsd';
export { agentHasUnread } from './slices/agents/agentHasUnread';

const DEFAULT_SESSION_VIEW_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };
const EMPTY_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];
const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_TERMINAL_TABS: ReadonlyArray<TerminalTab> = [];

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

export const useRunSpendUsd = (sessionId: SessionId, workflowRunId: WorkflowRunId): number =>
  useAppStore((state) =>
    runSpendUsd({
      records: state.sessionTelemetry[sessionId] ?? EMPTY_TELEMETRY,
      agents: state.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS,
      agentRunHistory: state.agentRunHistory,
      workflowRunId,
    }),
  );

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
const EMPTY_WORKSPACES: ReadonlyArray<Workspace> = [];

type StageInfoState = Pick<
  AppState,
  | 'sessions'
  | 'workspaces'
  | 'sessionBranches'
  | 'sessionWorktrees'
  | 'sessionMounts'
  | 'sessionActiveMount'
  | 'sessionGithub'
  | 'sessionGitlabMr'
  | 'sessionOpenQuestions'
  | 'sessionPhaseRuns'
  | 'selectedAgentId'
  | 'currentSessionId'
  | 'githubStatus'
>;

function countOpenQuestions(state: StageInfoState, sessionId: SessionId): number {
  const questions = state.sessionOpenQuestions[sessionId];
  if (!questions) {
    return 0;
  }
  return questions.filter((q) => q.status === 'open').length;
}

function sessionHasUnreadIn(state: StageInfoState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  if (!runs) {
    return false;
  }
  const selected = state.selectedAgentId[sessionId] ?? null;
  const isCurrent = state.currentSessionId === sessionId;
  return runs.some((r) => agentHasUnread(r, isCurrent && r.id === selected));
}

function sessionHasRunningAgentIn(state: StageInfoState, sessionId: SessionId): boolean {
  const runs = state.sessionPhaseRuns[sessionId];
  return runs ? runs.some((r) => r.status === 'running') : false;
}

function stageInfoOf(state: StageInfoState, session: Session): SessionStageInfo {
  const sessionId = session.id as SessionId;
  const isBranchless = isBranchlessSession({
    workspaceKind: state.workspaces.find((workspace) => workspace.id === session.workspaceId)?.kind,
    branch: state.sessionBranches[sessionId],
  });
  const request = resolveSessionRequest({
    pr: state.sessionGithub[sessionId]?.pr ?? null,
    mr: state.sessionGitlabMr[sessionId]?.mr ?? null,
  });
  return deriveSessionStage({
    session,
    pr: request.pr,
    requestLabel: request.requestLabel,
    prFetchState: sessionPrFetchState({
      githubAvailable: state.githubStatus?.available ?? null,
      fetchedAt: state.sessionGithub[sessionId]?.fetchedAt ?? null,
      failedAt: state.sessionGithub[sessionId]?.failedAt ?? null,
      fetchable: isSessionPrFetchable({ state, sessionId }),
    }),
    hasUnread: sessionHasUnreadIn(state, sessionId),
    openQuestionCount: countOpenQuestions(state, sessionId),
    hasRunningAgent: sessionHasRunningAgentIn(state, sessionId),
    isPrReview: isPrReviewSession({ agents: state.sessionPhaseRuns[sessionId] ?? [] }),
    isBranchless,
  });
}

export const useSessionStageInfo = (session: Session): SessionStageInfo => {
  const stage = useAppStore((s) => stageInfoOf(s, session).stage);
  const reason = useAppStore((s) => stageInfoOf(s, session).reason);
  return useMemo(() => ({ stage, reason }), [stage, reason]);
};

export const useSessionPrFetchState = (sessionId: SessionId): SessionPrFetchState =>
  useAppStore((s) =>
    sessionPrFetchState({
      githubAvailable: s.githubStatus?.available ?? null,
      fetchedAt: s.sessionGithub[sessionId]?.fetchedAt ?? null,
      failedAt: s.sessionGithub[sessionId]?.failedAt ?? null,
      fetchable: isSessionPrFetchable({ state: s, sessionId }),
    }),
  );

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
  const sessionGitlabMr = useAppStore((s) =>
    needsStage ? s.sessionGitlabMr : (EMPTY_GITHUB_STATE as typeof s.sessionGitlabMr),
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
  const githubStatus = useAppStore((s) => (needsStage ? s.githubStatus : null));
  const workspaces = useAppStore((s) => (needsStage ? s.workspaces : EMPTY_WORKSPACES));
  const sessionBranches = useAppStore((s) =>
    needsStage ? s.sessionBranches : (EMPTY_GITHUB_STATE as typeof s.sessionBranches),
  );
  const sessionWorktrees = useAppStore((s) =>
    needsStage ? s.sessionWorktrees : (EMPTY_GITHUB_STATE as typeof s.sessionWorktrees),
  );
  const sessionMounts = useAppStore((s) =>
    needsStage ? s.sessionMounts : (EMPTY_GITHUB_STATE as typeof s.sessionMounts),
  );
  const sessionActiveMount = useAppStore((s) =>
    needsStage ? s.sessionActiveMount : (EMPTY_GITHUB_STATE as typeof s.sessionActiveMount),
  );
  return useMemo(() => {
    const partial: StageInfoState = {
      sessions,
      workspaces,
      sessionBranches,
      sessionWorktrees,
      sessionMounts,
      sessionActiveMount,
      sessionGithub,
      sessionGitlabMr,
      sessionOpenQuestions,
      sessionPhaseRuns,
      selectedAgentId,
      currentSessionId,
      githubStatus,
    };
    const stages: Record<SessionId, SessionStage> = {};
    if (needsStage) {
      for (const session of sessions) {
        stages[session.id as SessionId] = stageInfoOf(partial, session).stage;
      }
    }
    return sortAndGroupSessions(sessions, prefs, sessionGithub, stages);
  }, [
    sessions,
    prefs,
    needsStage,
    workspaces,
    sessionBranches,
    sessionWorktrees,
    sessionMounts,
    sessionActiveMount,
    sessionGithub,
    sessionGitlabMr,
    sessionOpenQuestions,
    sessionPhaseRuns,
    selectedAgentId,
    currentSessionId,
    githubStatus,
  ]);
};

function groupedSessionsEqual(
  next: ReadonlyArray<GroupedSessions>,
  prev: ReadonlyArray<GroupedSessions>,
): boolean {
  if (next.length !== prev.length) {
    return false;
  }
  for (let i = 0; i < next.length; i++) {
    const nextGroup = next[i];
    const prevGroup = prev[i];
    if (nextGroup === undefined || prevGroup === undefined) {
      return false;
    }
    if (nextGroup.key !== prevGroup.key) {
      return false;
    }
    if (nextGroup.sessions.length !== prevGroup.sessions.length) {
      return false;
    }
    for (let j = 0; j < nextGroup.sessions.length; j++) {
      if (nextGroup.sessions[j] !== prevGroup.sessions[j]) {
        return false;
      }
    }
  }
  return true;
}

export const useStageGroupedSessions = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): ReadonlyArray<GroupedSessions> => {
  const prefs = useSessionViewPrefs(workspaceId);
  const sessionGithub = useAppStore((s) => s.sessionGithub);
  const sessionGitlabMr = useAppStore((s) => s.sessionGitlabMr);
  const sessionOpenQuestions = useAppStore((s) => s.sessionOpenQuestions);
  const sessionPhaseRuns = useAppStore((s) => s.sessionPhaseRuns);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const githubStatus = useAppStore((s) => s.githubStatus);
  const workspaces = useAppStore((s) => s.workspaces);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const sessionWorktrees = useAppStore((s) => s.sessionWorktrees);
  const sessionMounts = useAppStore((s) => s.sessionMounts);
  const sessionActiveMount = useAppStore((s) => s.sessionActiveMount);
  const previousRef = useRef<ReadonlyArray<GroupedSessions> | null>(null);
  const grouped = useMemo(() => {
    const partial: StageInfoState = {
      sessions,
      workspaces,
      sessionBranches,
      sessionWorktrees,
      sessionMounts,
      sessionActiveMount,
      sessionGithub,
      sessionGitlabMr,
      sessionOpenQuestions,
      sessionPhaseRuns,
      selectedAgentId,
      currentSessionId,
      githubStatus,
    };
    const stages: Record<SessionId, SessionStage> = {};
    for (const session of sessions) {
      stages[session.id as SessionId] = stageInfoOf(partial, session).stage;
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
    workspaces,
    sessionBranches,
    sessionWorktrees,
    sessionMounts,
    sessionActiveMount,
    sessionGithub,
    sessionGitlabMr,
    sessionOpenQuestions,
    sessionPhaseRuns,
    selectedAgentId,
    currentSessionId,
    githubStatus,
  ]);
  if (previousRef.current !== null && groupedSessionsEqual(grouped, previousRef.current)) {
    return previousRef.current;
  }
  previousRef.current = grouped;
  return grouped;
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

type SessionCollection =
  | 'agents'
  | 'plans'
  | 'workflows'
  | 'reviewDrafts'
  | 'externalTasks'
  | 'openQuestions'
  | 'fileVersions';

type SessionCollectionParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly collection: SessionCollection;
};

const isSessionCollectionLoaded = ({
  state,
  sessionId,
  collection,
}: SessionCollectionParams): boolean => {
  switch (collection) {
    case 'agents':
      return state.sessionPhaseRuns[sessionId] !== undefined;
    case 'plans':
      return state.sessionPlans[sessionId] !== undefined;
    case 'workflows':
      return state.sessionWorkflows[sessionId] !== undefined;
    case 'reviewDrafts':
      return state.reviewDrafts[sessionId] !== undefined;
    case 'externalTasks':
      return state.sessionExternalTasks[sessionId] !== undefined;
    case 'openQuestions':
      return state.sessionOpenQuestions[sessionId] !== undefined;
    case 'fileVersions':
      return state.sessionFileVersions[sessionId] !== undefined;
    default: {
      const exhaustive: never = collection;
      return exhaustive;
    }
  }
};

type UseSessionCollectionParams = {
  readonly sessionId: SessionId;
  readonly collection: SessionCollection;
};

export const useIsSessionCollectionLoaded = ({
  sessionId,
  collection,
}: UseSessionCollectionParams): boolean =>
  useAppStore((state) => isSessionCollectionLoaded({ state, sessionId, collection }));

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

export const useLiveTerminalCount = (sessionId: SessionId | null): number =>
  useAppStore((s) => {
    if (sessionId == null) {
      return 0;
    }
    const tabs = s.terminalTabs[sessionId] ?? EMPTY_TERMINAL_TABS;
    const liveTabs = tabs.filter((tab) => tab.status !== 'exited').length;
    return liveTabs + (s.terminalSessions[sessionId] === 'open' ? 1 : 0);
  });

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

export const useSlotHistoryCount = (sessionId: SessionId | null, key: string): number =>
  useAppStore((s) => (sessionId ? (s.slotHistoryCounts[sessionId]?.[key] ?? 0) : 0));

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
    sessionId == null ? null : (resolveSessionRepo({ state: s, sessionId })?.worktreePath ?? null),
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
    const rootAgent = resolveRootAgent({ agents: phaseRuns, agentId: unreadAgent.id });
    if (rootAgent == null) {
      return null;
    }
    const kind = classifyAgent(rootAgent, agentKindOverride[rootAgent.id] ?? null);
    return agentHomeLens(rootAgent, kind);
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
