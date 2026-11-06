import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { readAgentQueue } from './queueStore';
import type { AgentQueuedTurnInput, QueuedTurnDelivery } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  turn: AgentQueuedTurnInput;
  isForced?: boolean;
}>;

const ELSEWHERE: QueuedTurnDelivery = { isDelivered: false, failure: null };

export const sendAgentMessage = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, turn, isForced = false }: Params): Promise<QueuedTurnDelivery> => {
    await get().enqueueAgentMessage({ turn, isDirect: true });
    const written = readAgentQueue({ get, agentId: turn.agentId }).find(
      (item) => item.id === turn.id,
    );
    if (written === undefined || written.status !== 'sending') {
      return ELSEWHERE;
    }
    return deliverQueuedTurn({ set, get, sessionId, turn: written, isForced });
  };
};
