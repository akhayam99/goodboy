import type { SessionId } from '@goodboy/types';
import { classifyAgent } from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';

const resolverActivationsInFlight = new Set<SessionId>();

export const activateNextResolver = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    if (resolverActivationsInFlight.has(sessionId)) {
      return;
    }
    const pending = get().pendingResolverKickoff;
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const resolvers = runs.filter(
      (agent) => classifyAgent(agent, get().agentKindOverride[agent.id] ?? null) === 'resolver',
    );
    const anyRunning = resolvers.some((a) => a.status === 'running');
    if (anyRunning) {
      return;
    }
    const next = resolvers
      .filter((a) => a.status === 'pending' && a.doneAt == null && pending[a.id] !== undefined)
      .sort((a, b) => a.ordinal - b.ordinal)[0];
    if (!next) {
      return;
    }
    const kickoff = pending[next.id];
    if (kickoff === undefined) {
      return;
    }
    resolverActivationsInFlight.add(sessionId);
    set((s) => {
      const nextPending = { ...s.pendingResolverKickoff };
      delete nextPending[next.id];
      return { pendingResolverKickoff: nextPending };
    });
    void get()
      .sendTurn({ sessionId, agentId: next.id, content: kickoff })
      .finally(() => {
        resolverActivationsInFlight.delete(sessionId);
      });
  };
};
