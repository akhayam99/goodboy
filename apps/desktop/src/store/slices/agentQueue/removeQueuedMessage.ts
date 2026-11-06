import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueItemInSessionParams, GetFn, SetFn } from './types';

export const removeQueuedMessage = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, itemId }: AgentQueueItemInSessionParams): Promise<void> => {
    const current = readAgentQueue({ get, agentId });
    const target = current.find((item) => item.id === itemId);
    if (target === undefined || target.status === 'sending') {
      return;
    }
    writeAgentQueue({ set, agentId, queue: current.filter((item) => item.id !== itemId) });
    await persistAgentQueue({ get, agentId });
    void get().drainAgentQueue({ sessionId, agentId });
  };
};
