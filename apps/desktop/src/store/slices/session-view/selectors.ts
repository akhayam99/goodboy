import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  AgentId,
  Session,
  SessionId,
  SessionStage,
  SessionStageInfo,
  SessionViewPrefs,
  TurnState,
  WorkspaceId,
} from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import { useAppStore } from '../../store';
import { useProjectFilteredSessions } from '../sessionFilters/selectors';
import { useProjectMountsForSessions } from '../project-mounts/useProjectMountsForSessions';
import { useTelemetryForSessions } from '../sessions/selectors';
import { useDormantSpend } from '../dormant-spend/selectors';
import { spendSources } from '../../../shared/utils/spendSources';
import { usePinnedSessionIds } from '../session-pins/selectors';
import { filterSessionsByStatus, withExemptSessions } from './filterSessionList';
import { sortAndGroupSessions } from './sortAndGroupSessions';
import { layoutSessionColumn, type SessionColumnLayout } from './layoutSessionColumn';
import { splitInactiveSessions } from './splitInactiveSessions';
import { useSessionInactivity } from './useSessionInactivity';
import { projectsBySession } from './projectOfSession';
import { DEFAULT_PREFS, type GroupedSessions } from './types';
import { stageInfoOf, type StageInfoState } from './stageInfoOf';

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

  return prefs ?? DEFAULT_PREFS;
};

function liveAgentTurnStateOf(
  sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>>,
  agentTurnState: Readonly<Record<AgentId, TurnState>>,
): Readonly<Record<AgentId, TurnState>> {
  const entries: Record<AgentId, TurnState> = {};
  for (const runs of Object.values(sessionPhaseRuns)) {
    for (const run of runs) {
      const turnState = agentTurnState[run.id];
      if (turnState !== undefined && isTurnStateLive({ turnState, includeBlocked: true })) {
        entries[run.id] = turnState;
      }
    }
  }
  return entries;
}

const pickBySessions = <T>({
  map,
  sessions,
}: {
  readonly map: Readonly<Record<SessionId, T>> | undefined;
  readonly sessions: ReadonlyArray<Session>;
}): Readonly<Record<SessionId, T>> => {
  const picked: Record<SessionId, T> = {};
  for (const session of sessions) {
    const value = map?.[session.id];
    if (value !== undefined) {
      picked[session.id] = value;
    }
  }
  return picked;
};

export const useSessionStageInfo = (session: Session): SessionStageInfo =>
  useAppStore(useShallow((s) => stageInfoOf(s, session)));

export const useSessionStages = (
  sessions: ReadonlyArray<Session>,
): Readonly<Record<string, SessionStage>> =>
  useAppStore(
    useShallow((s) =>
      Object.fromEntries(sessions.map((session) => [session.id, stageInfoOf(s, session).stage])),
    ),
  );

const stagesEqual = (
  next: Readonly<Record<SessionId, SessionStage>>,
  prev: Readonly<Record<SessionId, SessionStage>>,
): boolean => {
  const keys = Object.keys(next) as SessionId[];
  return keys.length === Object.keys(prev).length && keys.every((id) => next[id] === prev[id]);
};

const useStableStages = (
  stages: Readonly<Record<SessionId, SessionStage>>,
): Readonly<Record<SessionId, SessionStage>> => {
  const ref = useRef(stages);
  if (!stagesEqual(stages, ref.current)) {
    ref.current = stages;
  }
  return ref.current;
};

const NO_EXEMPT_IDS: ReadonlySet<string> = new Set();

type StageSourcesParams = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Session>;
  readonly exemptIds?: ReadonlySet<string>;
};

const useStageSources = ({
  workspaceId,
  sessions,
  exemptIds = NO_EXEMPT_IDS,
}: StageSourcesParams) => {
  const projectMatched = useProjectFilteredSessions({ workspaceId, sessions });
  const filteredSessions = useMemo(
    () => withExemptSessions({ sessions, matched: projectMatched, exemptIds }),
    [sessions, projectMatched, exemptIds],
  );
  const sessionGithub = useAppStore((s) => s.sessionGithub);
  const sessionGitlabMr = useAppStore((s) => s.sessionGitlabMr);
  const sessionOpenQuestions = useAppStore((s) => s.sessionOpenQuestions);
  const sessionPhaseRuns = useAppStore((s) => s.sessionPhaseRuns);
  const agentTurnState = useAppStore(
    useShallow((s) => liveAgentTurnStateOf(sessionPhaseRuns, s.agentTurnState)),
  );
  const orchestratingWorkflowRuns = useAppStore((s) => s.orchestratingWorkflowRuns);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId);
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const githubStatus = useAppStore((s) => s.githubStatus);
  const sessionResolveThreads = useAppStore(
    useShallow((s) => pickBySessions({ map: s.sessionResolveThreads, sessions: filteredSessions })),
  );
  const sessionResolveAttempts = useAppStore(
    useShallow((s) =>
      pickBySessions({ map: s.sessionResolveAttempts, sessions: filteredSessions }),
    ),
  );
  const workspaces = useAppStore((s) => s.workspaces);
  const projects = useAppStore((s) => s.projects);
  const sessionBranches = useAppStore((s) => s.sessionBranches);
  const sessionWorktrees = useAppStore((s) => s.sessionWorktrees);
  const sessionProjectMounts = useProjectMountsForSessions({ sessions: filteredSessions });
  const sessionActiveProject = useAppStore((s) => s.sessionActiveProject);
  const sessionMounts = useAppStore((s) => s.sessionMounts);
  const sessionActiveMount = useAppStore((s) => s.sessionActiveMount);
  const mountGithub = useAppStore((s) => s.mountGithub);
  const mountGitlabMr = useAppStore((s) => s.mountGitlabMr);
  const mountBitbucketPr = useAppStore((s) => s.mountBitbucketPr);
  const prSeries = useAppStore((s) => s.prSeries);
  const stages = useMemo(() => {
    const partial: StageInfoState = {
      sessions: filteredSessions,
      workspaces,
      projects,
      sessionBranches,
      sessionWorktrees,
      sessionProjectMounts,
      sessionMounts,
      sessionActiveMount,
      sessionActiveProject,
      mountGithub,
      mountGitlabMr,
      mountBitbucketPr,
      prSeries,
      sessionGithub,
      sessionGitlabMr,
      sessionOpenQuestions,
      sessionPhaseRuns,
      agentTurnState,
      orchestratingWorkflowRuns,
      selectedAgentId,
      currentSessionId,
      githubStatus,
      sessionResolveThreads,
      sessionResolveAttempts,
    };
    const stageMap: Record<SessionId, SessionStage> = {};
    const infoMap: Record<SessionId, SessionStageInfo> = {};
    for (const session of filteredSessions) {
      const info = stageInfoOf(partial, session);
      stageMap[session.id] = info.stage;
      infoMap[session.id] = info;
    }
    return { stageMap, infoMap };
  }, [
    filteredSessions,
    workspaces,
    projects,
    sessionBranches,
    sessionWorktrees,
    sessionProjectMounts,
    sessionMounts,
    sessionActiveMount,
    sessionActiveProject,
    mountGithub,
    mountGitlabMr,
    mountBitbucketPr,
    prSeries,
    sessionGithub,
    sessionGitlabMr,
    sessionOpenQuestions,
    sessionPhaseRuns,
    agentTurnState,
    orchestratingWorkflowRuns,
    selectedAgentId,
    currentSessionId,
    githubStatus,
    sessionResolveThreads,
    sessionResolveAttempts,
  ]);
  return {
    filteredSessions,
    stages: useStableStages(stages.stageMap),
    infos: stages.infoMap,
    sessionGithub,
    mountGithub,
    sessionPhaseRuns,
    sessionProjectMounts,
    projects,
  };
};

const useLastTurnBySession = (sessions: ReadonlyArray<Session>): Readonly<Record<string, string>> =>
  useAppStore(
    useShallow((s) => {
      const ids = new Set<string>(sessions.map((session) => session.id));
      const picked: Record<string, string> = {};
      for (const [sessionId, runs] of Object.entries(s.sessionPhaseRuns)) {
        if (!ids.has(sessionId)) {
          continue;
        }
        for (const run of runs) {
          const finished = run.lastFinishedAt ?? null;
          const known = picked[sessionId];
          if (finished !== null && (known === undefined || finished > known)) {
            picked[sessionId] = finished;
          }
        }
      }
      return picked;
    }),
  );

export type SessionListModel = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly hiddenByFilters: number;
  readonly inactiveLabels: Readonly<Record<SessionId, string>>;
};

export const useSessionListModel = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): SessionListModel => {
  const prefs = useSessionViewPrefs(workspaceId);
  const pinnedIds = usePinnedSessionIds({ workspaceId });
  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const exemptIds = useMemo(
    () => new Set<string>(currentSessionId === null ? pinnedIds : [...pinnedIds, currentSessionId]),
    [pinnedIds, currentSessionId],
  );
  const {
    filteredSessions,
    stages,
    infos,
    sessionGithub,
    mountGithub,
    sessionPhaseRuns,
    sessionProjectMounts,
    projects,
  } = useStageSources({ workspaceId, sessions, exemptIds });
  const lastTurnBySession = useLastTurnBySession(filteredSessions);
  const inactivity = useSessionInactivity({
    sessions: filteredSessions,
    infos,
    pinnedIds,
    currentSessionId,
    sessionPhaseRuns,
    sessionGithub,
    mountGithub,
    sessionProjectMounts,
  });
  return useMemo(() => {
    const shown = filterSessionsByStatus({
      sessions: filteredSessions,
      statusFilter: prefs.statusFilter,
      stageBySession: stages,
      exemptIds,
    });
    const sorted = sortAndGroupSessions({
      sessions: shown,
      prefs,
      githubState: sessionGithub,
      stageBySession: stages,
      lastTurnBySession,
      projectBySession:
        prefs.group === 'project'
          ? projectsBySession({
              sessions: shown,
              mountsBySession: sessionProjectMounts,
              projects,
            })
          : {},
    });
    return {
      groups: splitInactiveSessions({ groups: sorted, inactiveSince: inactivity.since }),
      stageBySession: stages,
      hiddenByFilters: sessions.length - shown.length,
      inactiveLabels: inactivity.labels,
    };
  }, [
    filteredSessions,
    sessions.length,
    prefs,
    sessionGithub,
    stages,
    sessionProjectMounts,
    projects,
    exemptIds,
    lastTurnBySession,
    inactivity,
  ]);
};

type SessionColumn = SessionColumnLayout & {
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly hiddenByFilters: number;
  readonly inactiveLabels: Readonly<Record<SessionId, string>>;
};

export const useSessionColumn = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): SessionColumn => {
  const prefs = useSessionViewPrefs(workspaceId);
  const { groups, stageBySession, hiddenByFilters, inactiveLabels } = useSessionListModel(
    workspaceId,
    sessions,
  );
  const groupExpanded = useAppStore((s) => s.sessionGroupExpanded);
  const currentSessionId = useAppStore((s) => s.currentSessionId as SessionId | null);
  const pinnedIds = usePinnedSessionIds({ workspaceId });
  return useMemo(
    () => ({
      ...layoutSessionColumn({
        groups,
        prefs,
        groupExpanded,
        currentSessionId,
        stageBySession,
        pinnedIds,
      }),
      stageBySession,
      hiddenByFilters,
      inactiveLabels,
    }),
    [
      groups,
      prefs,
      groupExpanded,
      currentSessionId,
      stageBySession,
      pinnedIds,
      hiddenByFilters,
      inactiveLabels,
    ],
  );
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
  const { filteredSessions, stages, sessionGithub } = useStageSources({ workspaceId, sessions });
  const lastTurnBySession = useLastTurnBySession(filteredSessions);
  const previousRef = useRef<ReadonlyArray<GroupedSessions> | null>(null);
  const grouped = useMemo(
    () =>
      sortAndGroupSessions({
        sessions: filteredSessions,
        prefs: { ...prefs, group: 'stage' },
        githubState: sessionGithub,
        stageBySession: stages,
        lastTurnBySession,
      }),
    [filteredSessions, prefs, sessionGithub, stages, lastTurnBySession],
  );
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
  const sessionTelemetry = useTelemetryForSessions({ sessions });
  const dormant = useDormantSpend();
  return useMemo(() => {
    const countOf = (key: string) => groups.find((g) => g.key === key)?.sessions.length ?? 0;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const cutoff = startOfDay.getTime();
    let todaySpend = 0;
    for (const source of spendSources({ sessions, telemetryMap: sessionTelemetry, dormant })) {
      for (const rec of source.records) {
        if (Date.parse(rec.recordedAt) < cutoff) {
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
  }, [dormant, groups, sessionTelemetry, sessions]);
};
