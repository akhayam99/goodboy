import type { SessionId } from '@goodboy/types';
import { readPersistedQueues, rememberSavedQueue } from './queueStore';
import type { GetFn, SetFn } from './types';

export const loadAgentQueues = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId): Promise<void> => {
    const agentIds = (get().sessionPhaseRuns[sessionId] ?? []).map((agent) => agent.id);
    const persisted = await readPersistedQueues(agentIds);
    if (persisted.size === 0) {
      return;
    }
    const adopted = [...persisted].filter(
      ([agentId]) => (get().agentQueue[agentId]?.length ?? 0) === 0,
    );
    if (adopted.length === 0) {
      return;
    }
    set((state) => ({ agentQueue: { ...state.agentQueue, ...Object.fromEntries(adopted) } }));
    for (const [agentId, queue] of adopted) {
      rememberSavedQueue({ agentId, ids: queue.map((turn) => turn.id) });
    }
  };
};
