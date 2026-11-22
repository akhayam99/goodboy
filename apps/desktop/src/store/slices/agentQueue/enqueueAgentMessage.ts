import type { IsoDateTime } from '@goodboy/types';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueHold, AgentQueuedTurn, AgentQueuedTurnInput, GetFn, SetFn } from './types';

type Params = Readonly<{
  turn: AgentQueuedTurnInput;
  placement?: 'last' | 'first';
  isDirect?: boolean;
  shouldDropUnsaved?: boolean;
  hold?: AgentQueueHold;
}>;

export const enqueueAgentMessage = (set: SetFn, get: GetFn) => {
  return async ({
    turn,
    placement = 'last',
    isDirect = false,
    shouldDropUnsaved = false,
    hold,
  }: Params): Promise<boolean> => {
    const queued: AgentQueuedTurn = {
      ...turn,
      status: isDirect ? 'sending' : 'queued',
      createdAt: new Date().toISOString() as IsoDateTime,
      ...(isDirect && { isDirect: true }),
      ...(hold !== undefined && !isDirect && { hold }),
    };
    const current = readAgentQueue({ get, agentId: turn.agentId });
    if (current.some((item) => item.id === turn.id)) {
      return false;
    }
    const sending = current.filter((item) => item.status === 'sending');
    const waiting = current.filter((item) => item.status !== 'sending');
    writeAgentQueue({
      set,
      agentId: turn.agentId,
      queue: placement === 'first' ? [...sending, queued, ...waiting] : [...current, queued],
    });
    const isSaved = await persistAgentQueue({ get, agentId: turn.agentId });
    if (isSaved || !shouldDropUnsaved) {
      return isSaved;
    }
    const latest = readAgentQueue({ get, agentId: turn.agentId });
    const written = latest.find((item) => item.id === turn.id);
    if (written !== undefined && written.status === 'sending' && written.isDirect !== true) {
      return true;
    }
    writeAgentQueue({
      set,
      agentId: turn.agentId,
      queue: latest.filter((item) => item.id !== turn.id),
    });
    await persistAgentQueue({ get, agentId: turn.agentId });
    return false;
  };
};
