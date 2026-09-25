import type { SessionId } from '@goodboy/types';
import { readPersistedQueues } from './queueStore';
import type { GetFn, SetFn } from './types';

export const loadAgentQueues = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const agentIds = (get().sessionPhaseRuns[sessionId] ?? []).map((agent) => agent.id);
    const persisted = await readPersistedQueues(agentIds);
    if (persisted.size === 0) {
      return;
    }
    set((state) => {
      const next = { ...state.agentQueue };
      for (const [agentId, queue] of persisted) {
        if ((next[agentId]?.length ?? 0) === 0) {
          next[agentId] = queue;
        }
      }
      return { agentQueue: next };
    });
  };
};
