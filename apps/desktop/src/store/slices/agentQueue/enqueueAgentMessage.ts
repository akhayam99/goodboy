import type { IsoDateTime } from '@goodboy/types';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueuedTurn, AgentQueuedTurnInput, GetFn, SetFn } from './types';

type Params = Readonly<{
  turn: AgentQueuedTurnInput;
  placement?: 'last' | 'first';
}>;

export const enqueueAgentMessage = (set: SetFn, get: GetFn) => {
  return async ({ turn, placement = 'last' }: Params): Promise<void> => {
    const queued: AgentQueuedTurn = {
      ...turn,
      status: 'queued',
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    const current = readAgentQueue({ get, agentId: turn.agentId });
    const sending = current.filter((item) => item.status === 'sending');
    const waiting = current.filter((item) => item.status !== 'sending');
    writeAgentQueue({
      set,
      agentId: turn.agentId,
      queue: placement === 'first' ? [...sending, queued, ...waiting] : [...current, queued],
    });
    await persistAgentQueue({ get, agentId: turn.agentId });
  };
};
