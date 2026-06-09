import type { SessionId } from '@goodboy/types';
import { resolveAgentKind } from '../../../features/session/agent-kind';
import type { GetFn, SetFn } from './types';

export const activateNextResolver = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const pending = get().pendingResolverKickoff;
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const resolvers = runs.filter(
      (a) => resolveAgentKind(a.name, null, get().agentKindOverride[a.id] ?? null) === 'resolver',
    );
    const anyRunning = resolvers.some((a) => a.status === 'running');
    if (anyRunning) return;
    const next = resolvers
      .filter((a) => a.status === 'pending' && pending[a.id] !== undefined)
      .sort((a, b) => a.ordinal - b.ordinal)[0];
    if (!next) return;
    const kickoff = pending[next.id];
    if (kickoff === undefined) return;
    set((s) => {
      const nextPending = { ...s.pendingResolverKickoff };
      delete nextPending[next.id];
      return { pendingResolverKickoff: nextPending };
    });
    await get().selectAgent(sessionId, next.id);
    void get().sendTurn({ sessionId, agentId: next.id, content: kickoff });
  };
};
