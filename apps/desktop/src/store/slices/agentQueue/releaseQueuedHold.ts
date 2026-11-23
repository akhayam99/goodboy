import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { SliceDeps } from '../../slice-types';
import type { AgentQueueItemInSessionParams } from './types';

export const releaseQueuedHold = ({ set, get }: SliceDeps) => {
  return async ({
    sessionId,
    agentId,
    itemId,
  }: AgentQueueItemInSessionParams): Promise<boolean> => {
    const current = readAgentQueue({ get, agentId });
    const target = current.find((item) => item.id === itemId);
    if (target === undefined || target.status !== 'queued' || target.hold === undefined) {
      return false;
    }
    writeAgentQueue({
      set,
      agentId,
      queue: current.map((item) => (item.id === itemId ? { ...item, hold: undefined } : item)),
    });
    const isSaved = await persistAgentQueue({ get, agentId });
    void get().drainAgentQueue({ sessionId, agentId });
    return isSaved;
  };
};
