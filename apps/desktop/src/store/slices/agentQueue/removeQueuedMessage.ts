import { CHECK_STATE } from '../notifications/errorRecovery';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import { releaseSourceThread } from './releaseSourceThread';
import type { AgentQueueItemInSessionParams, GetFn, SetFn } from './types';

export const removeQueuedMessage = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    itemId,
  }: AgentQueueItemInSessionParams): Promise<boolean> => {
    const current = readAgentQueue({ get, agentId });
    const index = current.findIndex((item) => item.id === itemId);
    const target = current[index];
    if (target === undefined || target.status === 'sending') {
      return false;
    }
    writeAgentQueue({ set, agentId, queue: current.filter((item) => item.id !== itemId) });
    const isSaved = await persistAgentQueue({ get, agentId });
    if (!isSaved) {
      const latest = readAgentQueue({ get, agentId });
      writeAgentQueue({
        set,
        agentId,
        queue: [...latest.slice(0, index), target, ...latest.slice(index)],
      });
      return false;
    }
    if (target.sourceThreadId !== undefined) {
      await releaseSourceThread({
        set,
        get,
        sessionId,
        agentId,
        threadId: target.sourceThreadId,
      }).catch((error: unknown) =>
        get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't free the comment",
          error,
          sessionId,
        }),
      );
    }
    void get().drainAgentQueue({ sessionId, agentId });
    return true;
  };
};
