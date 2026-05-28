import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import type { AppStore, SessionLoadingFlags } from './store';

export const EMPTY_LOADING: SessionLoadingFlags = {
  agents: false,
  transcript: false,
  telemetry: false,
  slots: false,
  plans: false,
  summary: false,
};

type SetFn = (p: Partial<AppStore> | ((s: AppStore) => Partial<AppStore>)) => void;

/**
 * Shared per-turn session state mutator. Called by every action that flips
 * the in-memory session.state + agentTurnState (sendTurn, cancelCurrentTurn,
 * endSession, deleteAgent). Lives here so slices can import it without
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

/**
 * Module-scoped registry of run IDs cancelled by the user via
 * cancelCurrentTurn. The stream-end finalization in sendTurn checks this set
 * and skips marking the agent as `completed`. A cancelled turn must NOT
 * count as a workflow step completion, otherwise the next-step CTA appears
 * prematurely.
 */
export const cancelledRunIds = new Set<ProviderRunId>();
