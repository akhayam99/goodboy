import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  AgentId,
  Project,
  Session,
  SessionId,
  SessionStage,
  SessionStageInfo,
  SessionViewPrefs,
  TurnState,
  Workspace,
  WorkspaceId,
} from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import { useAppStore } from '../../store';
import { useProjectFilteredSessions } from '../sessionFilters/selectors';
import { useProjectMountsForSessions } from '../project-mounts/useProjectMountsForSessions';
import { useTelemetryForSessions } from '../sessions/selectors';
import { useDormantSpend } from '../dormant-spend/selectors';
import { spendSources } from '../../../shared/utils/spendSources';
import { sortAndGroupSessions } from './sortAndGroupSessions';
import type { GroupedSessions } from './types';
import { stageInfoOf, type StageInfoState } from './stageInfoOf';

const DEFAULT_SESSION_VIEW_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };
const EMPTY_SESSIONS: ReadonlyArray<Session> = [];

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
const EMPTY_PROJECTS: ReadonlyArray<Project> = [];

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

export const useSortedGroupedSessions = (
  workspaceId: WorkspaceId | null,
  sessions: ReadonlyArray<Session>,
): ReadonlyArray<GroupedSessions> => {
  const filteredSessions = useProjectFilteredSessions({ workspaceId, sessions });
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
  const agentTurnState = useAppStore(
    useShallow((s) =>
      needsStage
        ? liveAgentTurnStateOf(sessionPhaseRuns, s.agentTurnState)
        : (EMPTY_GITHUB_STATE as Readonly<Record<AgentId, TurnState>>),
    ),
  );
  const orchestratingWorkflowRuns = useAppStore((s) =>
    needsStage
      ? s.orchestratingWorkflowRuns
      : (EMPTY_GITHUB_STATE as typeof s.orchestratingWorkflowRuns),
  );
  const selectedAgentId = useAppStore((s) =>
    needsStage ? s.selectedAgentId : (EMPTY_GITHUB_STATE as typeof s.selectedAgentId),
  );
  const currentSessionId = useAppStore((s) => (needsStage ? s.currentSessionId : null));
  const githubStatus = useAppStore((s) => (needsStage ? s.githubStatus : null));
  const workspaces = useAppStore((s) => (needsStage ? s.workspaces : EMPTY_WORKSPACES));
  const projects = useAppStore((s) => (needsStage ? s.projects : EMPTY_PROJECTS));
  const sessionBranches = useAppStore((s) =>
    needsStage ? s.sessionBranches : (EMPTY_GITHUB_STATE as typeof s.sessionBranches),
  );
  const sessionWorktrees = useAppStore((s) =>
    needsStage ? s.sessionWorktrees : (EMPTY_GITHUB_STATE as typeof s.sessionWorktrees),
  );
  const sessionProjectMounts = useProjectMountsForSessions({
    sessions: needsStage ? filteredSessions : EMPTY_SESSIONS,
  });
  const sessionActiveProject = useAppStore((s) =>
    needsStage ? s.sessionActiveProject : (EMPTY_GITHUB_STATE as typeof s.sessionActiveProject),
  );
  const sessionMounts = useAppStore((s) =>
    needsStage ? s.sessionMounts : (EMPTY_GITHUB_STATE as typeof s.sessionMounts),
  );
  const sessionActiveMount = useAppStore((s) =>
    needsStage ? s.sessionActiveMount : (EMPTY_GITHUB_STATE as typeof s.sessionActiveMount),
  );
  const mountGithub = useAppStore((s) =>
    needsStage ? s.mountGithub : (EMPTY_GITHUB_STATE as typeof s.mountGithub),
  );
  const mountGitlabMr = useAppStore((s) =>
    needsStage ? s.mountGitlabMr : (EMPTY_GITHUB_STATE as typeof s.mountGitlabMr),
  );
  const mountBitbucketPr = useAppStore((s) =>
    needsStage ? s.mountBitbucketPr : (EMPTY_GITHUB_STATE as typeof s.mountBitbucketPr),
  );
  const prSeries = useAppStore((s) =>
    needsStage ? s.prSeries : (EMPTY_GITHUB_STATE as typeof s.prSeries),
  );
  return useMemo(() => {
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
    };
    const stages: Record<SessionId, SessionStage> = {};
    if (needsStage) {
      for (const session of filteredSessions) {
        stages[session.id as SessionId] = stageInfoOf(partial, session).stage;
      }
    }
    return sortAndGroupSessions(filteredSessions, prefs, sessionGithub, stages);
  }, [
    filteredSessions,
    prefs,
    needsStage,
    workspaces,
    projects,
    sessionBranches,
    sessionWorktrees,
    sessionProjectMounts,
    sessionMounts,
    sessionActiveMount,
    sessionActiveProject,
    sessionGithub,
    sessionGitlabMr,
    sessionOpenQuestions,
    sessionPhaseRuns,
    agentTurnState,
    orchestratingWorkflowRuns,
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
  const filteredSessions = useProjectFilteredSessions({ workspaceId, sessions });
  const prefs = useSessionViewPrefs(workspaceId);
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
  const previousRef = useRef<ReadonlyArray<GroupedSessions> | null>(null);
  const grouped = useMemo(() => {
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
    };
    const stages: Record<SessionId, SessionStage> = {};
    for (const session of filteredSessions) {
      stages[session.id as SessionId] = stageInfoOf(partial, session).stage;
    }
    return sortAndGroupSessions(
      filteredSessions,
      { sort: prefs.sort, group: 'stage' },
      sessionGithub,
      stages,
    );
  }, [
    filteredSessions,
    prefs.sort,
    workspaces,
    projects,
    sessionBranches,
    sessionWorktrees,
    sessionProjectMounts,
    sessionMounts,
    sessionActiveMount,
    sessionActiveProject,
    sessionGithub,
    sessionGitlabMr,
    sessionOpenQuestions,
    sessionPhaseRuns,
    agentTurnState,
    orchestratingWorkflowRuns,
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
