import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type {
  Agent,
  ProviderRunId,
  Session,
  SessionId,
  TelemetryRecord,
  WorkflowRunId,
} from '@goodboy/types';
import { useAppStore } from '../../store';
import type { AppState } from '../../types';
import { sumSessionCost } from './sumSessionCost';
import { runSpendUsd } from '../workflows/runSpendUsd';
import { executedAgentRouting, type ExecutedAgentRouting } from '../turn/executedAgentRouting';
import type { SessionLoadingFlags } from './state';
import { selectSessionById } from './selectSessionById';

const EMPTY_TELEMETRY: ReadonlyArray<TelemetryRecord> = [];
const EMPTY_AGENTS: ReadonlyArray<Agent> = [];

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

const EMPTY_RUN_IDS: ReadonlyArray<ProviderRunId> = [];
const EMPTY_RUN_ROUTING: Readonly<Record<ProviderRunId, ExecutedAgentRouting>> = {};

type ExecutedRoutingParams = {
  readonly agent: Pick<Agent, 'id' | 'sessionId' | 'runId'>;
};

export const useExecutedAgentRouting = ({
  agent,
}: ExecutedRoutingParams): ExecutedAgentRouting | null => {
  const records = useAppStore(
    (state) => state.sessionTelemetry[agent.sessionId] ?? EMPTY_TELEMETRY,
  );
  const runHistory = useAppStore((state) => state.agentRunHistory[agent.id] ?? EMPTY_RUN_IDS);
  const liveRouting = useAppStore((state) => state.runRouting[agent.id] ?? EMPTY_RUN_ROUTING);
  const agentRunId = agent.runId ?? null;
  return useMemo(
    () => executedAgentRouting({ agentRunId, runHistory, records, liveRouting }),
    [agentRunId, runHistory, records, liveRouting],
  );
};

type ExecutedRoutingsParams = {
  readonly sessionId: SessionId;
  readonly agents: ReadonlyArray<Pick<Agent, 'id' | 'runId'>>;
};

export const useExecutedAgentRoutings = ({
  sessionId,
  agents,
}: ExecutedRoutingsParams): ReadonlyMap<string, ExecutedAgentRouting | null> => {
  const records = useAppStore((state) => state.sessionTelemetry[sessionId] ?? EMPTY_TELEMETRY);
  const runHistories = useAppStore(
    useShallow((state) => agents.map((agent) => state.agentRunHistory[agent.id])),
  );
  const liveRoutings = useAppStore(
    useShallow((state) => agents.map((agent) => state.runRouting[agent.id])),
  );
  return useMemo(
    () =>
      new Map(
        agents.map((agent, index) => [
          agent.id,
          executedAgentRouting({
            agentRunId: agent.runId ?? null,
            runHistory: runHistories[index] ?? EMPTY_RUN_IDS,
            records,
            liveRouting: liveRoutings[index] ?? EMPTY_RUN_ROUTING,
          }),
        ]),
      ),
    [agents, runHistories, liveRoutings, records],
  );
};

type SessionsParams = {
  readonly sessions: ReadonlyArray<Session>;
};

export const useTelemetryForSessions = ({
  sessions,
}: SessionsParams): AppState['sessionTelemetry'] =>
  useAppStore(
    useShallow((state) => {
      const picked: Record<string, ReadonlyArray<TelemetryRecord>> = {};
      for (const session of sessions) {
        const records = state.sessionTelemetry[session.id];
        if (records === undefined) {
          continue;
        }
        picked[session.id] = records;
      }
      return picked;
    }),
  );

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

const selectSessions = (state: AppState): ReadonlyArray<Session> => state.sessions;

const selectCurrentSession = (state: AppState): Session | null =>
  selectSessionById(state, state.currentSessionId);
export const useSessions = (): ReadonlyArray<Session> => useAppStore(selectSessions);
export const useCurrentSession = (): Session | null => useAppStore(selectCurrentSession);

export const useSessionById = (id: SessionId | null): Session | null => {
  const selector = useMemo(
    () =>
      (state: AppState): Session | null =>
        selectSessionById(state, id),
    [id],
  );
  return useAppStore(selector);
};
