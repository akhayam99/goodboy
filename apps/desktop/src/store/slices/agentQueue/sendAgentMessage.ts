import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueuedTurnInput, QueuedTurnDelivery } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  turn: AgentQueuedTurnInput;
  isForced?: boolean;
}>;

const ELSEWHERE: QueuedTurnDelivery = { isDelivered: false, failure: null };

const NOT_SAVED: QueuedTurnDelivery = {
  isDelivered: false,
  failure: "The message couldn't be saved, so it was not sent.",
  isUnwritten: true,
};

export const sendAgentMessage = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, turn, isForced = false }: Params): Promise<QueuedTurnDelivery> => {
    const { agentId } = turn;
    const isSaved = await get().enqueueAgentMessage({ turn, isDirect: true });
    if (!isSaved) {
      writeAgentQueue({
        set,
        agentId,
        queue: readAgentQueue({ get, agentId }).filter((item) => item.id !== turn.id),
      });
      return NOT_SAVED;
    }
    const written = readAgentQueue({ get, agentId }).find((item) => item.id === turn.id);
    if (written === undefined || written.status !== 'sending') {
      return ELSEWHERE;
    }
    return deliverQueuedTurn({ set, get, sessionId, turn: written, isForced });
  };
};
