import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueItemParams, AgentQueuedTurn, QueuedTurnDelivery } from './types';

type Params = AgentQueueItemParams &
  Readonly<{
    sessionId: SessionId;
    isForced?: boolean;
  }>;

const NOTHING_TO_RETRY: QueuedTurnDelivery = { isDelivered: false, failure: null };

export const retryQueuedMessage = ({ set, get }: SliceDeps) => {
  return async ({
    sessionId,
    agentId,
    itemId,
    isForced = false,
  }: Params): Promise<QueuedTurnDelivery> => {
    const current = readAgentQueue({ get, agentId });
    const target = current.find((item) => item.id === itemId);
    if (target === undefined || target.status !== 'queued' || target.hold === undefined) {
      return NOTHING_TO_RETRY;
    }
    if (current.some((item) => item.status === 'sending')) {
      return NOTHING_TO_RETRY;
    }
    const sending: AgentQueuedTurn = { ...target, status: 'sending', hold: undefined };
    writeAgentQueue({
      set,
      agentId,
      queue: current.map((item) => (item.id === itemId ? sending : item)),
    });
    return deliverQueuedTurn({ set, get, sessionId, turn: sending, isForced });
  };
};
