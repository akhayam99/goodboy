import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueItemParams, AgentQueuedTurn, GetFn, SetFn } from './types';

export const takeQueuedMessage = (set: SetFn, get: GetFn) => {
  return ({ agentId, itemId }: AgentQueueItemParams): AgentQueuedTurn | null => {
    const current = readAgentQueue({ get, agentId });
    const target = current.find((item) => item.id === itemId);
    if (target === undefined || target.status === 'sending') {
      return null;
    }
    writeAgentQueue({ set, agentId, queue: current.filter((item) => item.id !== itemId) });
    void persistAgentQueue({ get, agentId });
    return target;
  };
};
