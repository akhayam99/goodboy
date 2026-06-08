import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import type { SessionLoadingFlags } from './store';
import type { SetFn } from './slice-types';

export const EMPTY_LOADING: SessionLoadingFlags = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

/**
 * Shared per-turn session state mutator. Called by every action that flips
 * the in-memory session.state + agentTurnState (sendTurn, cancelCurrentTurn,
 * deleteAgent). Lives here so slices can import it without
 * depending on store.ts directly.
 */
export function applySessionUpdate(
  set: SetFn,
  sessionId: SessionId,
  state: TurnState,
  agentId?: AgentId,
): void {
  set((store) => ({
    sessions: store.sessions.map((s) =>
      s.id === sessionId ? { ...s, state, updatedAt: new Date().toISOString() as IsoDateTime } : s,
    ),
    ...(agentId !== undefined && {
      agentTurnState: { ...store.agentTurnState, [agentId]: state },
    }),
  }));
}

export function deriveSessionState(
  agentStates: ReadonlyArray<TurnState>,
  now: IsoDateTime,
): TurnState {
  const running = agentStates.filter(
    (s): s is Extract<TurnState, { kind: 'running' }> => s.kind === 'running',
  );
  if (running.length > 0) {
    const rep = running.reduce((a, b) => (a.startedAt >= b.startedAt ? a : b));
    return { kind: 'running', runId: rep.runId, startedAt: rep.startedAt };
  }
  const starting = agentStates.find((s) => s.kind === 'starting');
  if (starting) return starting;
  const errored = agentStates.find((s) => s.kind === 'error');
  if (errored) return errored;
  return { kind: 'idle', lastActivityAt: now };
}

export function applyAgentTurnState(
  set: SetFn,
  sessionId: SessionId,
  agentId: AgentId,
  agentState: TurnState,
  now: IsoDateTime,
): TurnState {
  let derived: TurnState = agentState;
  set((store) => {
    const nextAgentTurn: Record<AgentId, TurnState> = {
      ...store.agentTurnState,
      [agentId]: agentState,
    };
    const sessionAgentIds = (store.sessionPhaseRuns[sessionId] ?? []).map((a) => a.id);
    const ids = sessionAgentIds.includes(agentId) ? sessionAgentIds : [...sessionAgentIds, agentId];
    const states = ids
      .map((id) => nextAgentTurn[id])
      .filter((s): s is TurnState => s !== undefined);
    derived = deriveSessionState(states, now);
    return {
      sessions: store.sessions.map((s) =>
        s.id === sessionId ? { ...s, state: derived, updatedAt: now } : s,
      ),
      agentTurnState: nextAgentTurn,
    };
  });
  return derived;
}

/**
 * Module-scoped registry of run IDs cancelled by the user via
 * cancelCurrentTurn. The stream-end finalization in sendTurn checks this set
 * and skips marking the agent as `completed`. A cancelled turn must NOT
 * count as a workflow step completion, otherwise the next-step CTA appears
 * prematurely.
 */
export const cancelledRunIds = new Set<ProviderRunId>();
