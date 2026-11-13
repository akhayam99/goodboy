import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Session,
  SessionId,
  SessionStage,
  SessionStageInfo,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';
import { spendFigures } from '../../../features/budget/spendFigures';
import { attentionWordsOf } from '../../../features/session/session-stage';
import { useAppStore } from '../../store';
import { useProjectFilteredSessions } from '../sessionFilters/selectors';
import { useProjectMountsForSessions } from '../project-mounts/useProjectMountsForSessions';
import { useTelemetryForSessions } from '../sessions/selectors';
import { useDormantSpend } from '../dormant-spend/selectors';
import { spendSources } from '../../../shared/utils/spendSources';
import { usePinnedSessionIds } from '../session-pins/selectors';
import { filterSessionsByStatus, withExemptSessions } from './filterSessionList';
import { sortAndGroupSessions, type AttentionSinceBySession } from './sortAndGroupSessions';
import { layoutSessionColumn, type SessionColumnLayout } from './layoutSessionColumn';
import { splitDoneSessions } from './splitDoneSessions';
import { useSessionInactivity } from './useSessionInactivity';
import { projectsBySession } from './projectOfSession';
import { DEFAULT_PREFS, type GroupedSessions } from './types';
import { attentionCountOf, type AttentionCount } from './attentionCountOf';
import { cachedStageInfoOf } from './cachedStageInfoOf';
import { stageInfosOf } from './stageInfosOf';

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

export const useSessionStageInfo = (session: Session): SessionStageInfo =>
  useAppStore(useShallow((s) => cachedStageInfoOf({ state: s, session })));

export const useSessionStages = (
  sessions: ReadonlyArray<Session>,
): Readonly<Record<string, SessionStage>> =>
  useAppStore(
    useShallow((s) =>
      Object.fromEntries(
        sessions.map((session) => [session.id, cachedStageInfoOf({ state: s, session }).stage]),
      ),
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

type SinceParams = {
  readonly infos: Readonly<Record<SessionId, SessionStageInfo>>;
};

const attentionSinceOfInfos = ({ infos }: SinceParams): AttentionSinceBySession =>
  Object.fromEntries(Object.entries(infos).map(([id, info]) => [id, info.attentionSince]));

type StageSourcesParams = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Session>;
  readonly exemptIds?: ReadonlySet<string>;
  readonly isFilterIgnored?: boolean;
};

const useStageSources = ({
  workspaceId,
  sessions,
  exemptIds = NO_EXEMPT_IDS,
  isFilterIgnored = false,
}: StageSourcesParams) => {
  const projectMatched = useProjectFilteredSessions({ workspaceId, sessions });
  const filteredSessions = useMemo(
    () =>
      isFilterIgnored
        ? sessions
        : withExemptSessions({ sessions, matched: projectMatched, exemptIds }),
    [isFilterIgnored, sessions, projectMatched, exemptIds],
  );
  const sessionGithub = useAppStore((s) => s.sessionGithub);
  const sessionRequests = useAppStore((s) => s.sessionRequests);
  const sessionPhaseRuns = useAppStore((s) => s.sessionPhaseRuns);
  const projects = useAppStore((s) => s.projects);
  const sessionProjectMounts = useProjectMountsForSessions({ sessions: filteredSessions });
  const mountGithub = useAppStore((s) => s.mountGithub);
  const mountRequests = useAppStore((s) => s.mountRequests);
  const infos = useAppStore((s) => stageInfosOf({ state: s, sessions: filteredSessions }));
  const stageMap = useMemo(() => {
    const picked: Record<SessionId, SessionStage> = {};
    for (const session of filteredSessions) {
      const info = infos[session.id];
      if (info !== undefined) {
        picked[session.id] = info.stage;
      }
    }
    return picked;
  }, [filteredSessions, infos]);
  return {
    filteredSessions,
    stages: useStableStages(stageMap),
    infos,
    sessionGithub,
    mountGithub,
    sessionRequests,
    mountRequests,
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

type SessionListModel = {
  readonly groups: ReadonlyArray<GroupedSessions>;
  readonly stageBySession: Readonly<Record<SessionId, SessionStage>>;
  readonly hiddenByFilters: number;
  readonly inactiveLabels: Readonly<Record<SessionId, string>>;
};

const useSessionListModel = (
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
    sessionRequests,
    mountRequests,
    sessionPhaseRuns,
    sessionProjectMounts,
    projects,
  } = useStageSources({ workspaceId, sessions, exemptIds });
  const lastTurnBySession = useLastTurnBySession(filteredSessions);
  const attentionSinceBySession = useMemo(() => attentionSinceOfInfos({ infos }), [infos]);
  const inactivity = useSessionInactivity({
    sessions: filteredSessions,
    infos,
    pinnedIds,
    currentSessionId,
    sessionPhaseRuns,
    sessionGithub,
    mountGithub,
    sessionRequests,
    mountRequests,
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
      attentionSinceBySession,
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
      groups: splitDoneSessions({ groups: sorted, stageBySession: stages, exemptIds }),
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
    attentionSinceBySession,
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
  const { filteredSessions, stages, infos, sessionGithub } = useStageSources({
    workspaceId,
    sessions,
  });
  const lastTurnBySession = useLastTurnBySession(filteredSessions);
  const attentionSinceBySession = useMemo(() => attentionSinceOfInfos({ infos }), [infos]);
  const previousRef = useRef<ReadonlyArray<GroupedSessions> | null>(null);
  const grouped = useMemo(
    () =>
      sortAndGroupSessions({
        sessions: filteredSessions,
        prefs: { ...prefs, group: 'stage' },
        githubState: sessionGithub,
        stageBySession: stages,
        lastTurnBySession,
        attentionSinceBySession,
      }),
    [filteredSessions, prefs, sessionGithub, stages, lastTurnBySession, attentionSinceBySession],
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
    const records = spendSources({ sessions, telemetryMap: sessionTelemetry, dormant }).flatMap(
      (source) => source.records,
    );
    const figures = spendFigures({ records, nowMs: Date.now(), sinceMs: null });
    return {
      attentionCount: countOf('attention'),
      runningCount: countOf('running'),
      todaySpend: figures.today.usd,
    };
  }, [dormant, groups, sessionTelemetry, sessions]);
};

export type WorkspaceAttention = AttentionCount & {
  readonly reasons: ReadonlyArray<string>;
  readonly quietReasons: ReadonlyArray<string>;
  readonly countedSessions: ReadonlyArray<Session>;
};

type WordsParams = {
  readonly items: ReadonlyArray<{ readonly id: string; readonly info: SessionStageInfo }>;
  readonly isCounted: boolean;
  readonly counted: ReadonlySet<string>;
};

const reasonWordsOf = ({ items, isCounted, counted }: WordsParams): ReadonlyArray<string> => {
  const words = items.flatMap(({ id, info }) =>
    info.stage === 'attention' && info.attention !== null && counted.has(id) === isCounted
      ? [attentionWordsOf({ reason: info.attention, counts: info })]
      : [],
  );
  return [...new Set(words.filter((word) => word.trim() !== ''))];
};

type AttentionParams = {
  readonly workspaceId: WorkspaceId | null;
  readonly sessions: ReadonlyArray<Session>;
};

export const useWorkspaceAttention = ({
  workspaceId,
  sessions,
}: AttentionParams): WorkspaceAttention => {
  const { filteredSessions, infos } = useStageSources({
    workspaceId,
    sessions,
    isFilterIgnored: true,
  });
  return useMemo(() => {
    const items = filteredSessions.flatMap((session) => {
      const info = infos[session.id];
      return info === undefined ? [] : [{ id: session.id, info }];
    });
    const attention = attentionCountOf({ items });
    const counted = new Set(attention.countedIds);
    return {
      ...attention,
      reasons: reasonWordsOf({ items, isCounted: true, counted }),
      quietReasons: reasonWordsOf({ items, isCounted: false, counted }),
      countedSessions: filteredSessions.filter((session) => counted.has(session.id)),
    };
  }, [filteredSessions, infos]);
};
