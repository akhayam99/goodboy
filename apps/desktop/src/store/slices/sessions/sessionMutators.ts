import { failureStandingOf } from '@goodboy/core/attention';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TurnState,
} from '@goodboy/types';
import type { SessionLoadingFlags } from './state';
import type { SetFn } from '../../slice-types';
import type { AppStore } from '../../store';

export const EMPTY_LOADING: SessionLoadingFlags = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

export type AgentTurnEntry = Readonly<{
  agentId: AgentId;
  state: TurnState;
}>;

type DeriveParams = Readonly<{
  entries: ReadonlyArray<AgentTurnEntry>;
  agents: ReadonlyArray<Agent>;
  now: IsoDateTime;
  currentAgentId?: AgentId | null;
}>;

export const deriveSessionState = ({
  entries,
  agents,
  now,
  currentAgentId = null,
}: DeriveParams): TurnState => {
  const agentStates = entries.map((entry) => entry.state);
  const running = agentStates.filter(
    (s): s is Extract<TurnState, { kind: 'running' }> => s.kind === 'running',
  );
  if (running.length > 0) {
    const rep = running.reduce((a, b) => (a.startedAt >= b.startedAt ? a : b));
    return { kind: 'running', runId: rep.runId, startedAt: rep.startedAt };
  }
  const starting = agentStates.find((s) => s.kind === 'starting');
  if (starting) {
    return starting;
  }
  const { endedAgentIds } = failureStandingOf({ agents });
  const errored = entries.find(
    (entry) =>
      entry.state.kind === 'error' &&
      (entry.agentId === currentAgentId || !endedAgentIds.has(entry.agentId)),
  );
  if (errored) {
    return errored.state;
  }
  return { kind: 'idle', lastActivityAt: now };
};

type PlanAgentTurnStateParams = Readonly<{
  store: Pick<AppStore, 'agentTurnState' | 'sessionPhaseRuns'>;
  sessionId: SessionId;
  agentId: AgentId;
  agentState: TurnState;
  now: IsoDateTime;
}>;

type PlannedAgentTurnState = Readonly<{
  nextAgentTurn: Record<AgentId, TurnState>;
  derived: TurnState;
}>;

type EntriesParams = Readonly<{
  ids: ReadonlyArray<AgentId>;
  turns: Readonly<Record<AgentId, TurnState>>;
}>;

export const entriesOf = ({ ids, turns }: EntriesParams): ReadonlyArray<AgentTurnEntry> =>
  ids.flatMap((agentId) => {
    const state = turns[agentId];
    return state === undefined ? [] : [{ agentId, state }];
  });

export const planAgentTurnState = ({
  store,
  sessionId,
  agentId,
  agentState,
  now,
}: PlanAgentTurnStateParams): PlannedAgentTurnState => {
  const nextAgentTurn: Record<AgentId, TurnState> = {
    ...store.agentTurnState,
    [agentId]: agentState,
  };
  const agents = store.sessionPhaseRuns[sessionId] ?? [];
  const sessionAgentIds = agents.map((a) => a.id);
  const ids = sessionAgentIds.includes(agentId) ? sessionAgentIds : [...sessionAgentIds, agentId];
  return {
    nextAgentTurn,
    derived: deriveSessionState({
      entries: entriesOf({ ids, turns: nextAgentTurn }),
      agents,
      now,
      currentAgentId: agentId,
    }),
  };
};

export const applyAgentTurnState = (
  set: SetFn,
  sessionId: SessionId,
  agentId: AgentId,
  agentState: TurnState,
  now: IsoDateTime,
): TurnState => {
  let derived: TurnState = agentState;
  set((store) => {
    const planned = planAgentTurnState({ store, sessionId, agentId, agentState, now });
    const nextAgentTurn = planned.nextAgentTurn;
    derived = planned.derived;
    return {
      sessions: store.sessions.map((s) =>
        s.id === sessionId ? { ...s, state: derived, updatedAt: now } : s,
      ),
      agentTurnState: nextAgentTurn,
    };
  });
  return derived;
};

export const cancelledRunIds = new Set<ProviderRunId>();

export const purgedAgentIds = new Set<AgentId>();
