import { waitTurnSettled } from '../turn/turnSettled';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { beginHandoff, endHandoff } from './handoff';
import { readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueItemInSessionParams, GetFn, SetFn } from './types';

export const sendQueuedNow = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, itemId }: AgentQueueItemInSessionParams): Promise<void> => {
    const current = readAgentQueue({ get, agentId });
    const target = current.find((item) => item.id === itemId);
    if (target === undefined || target.status !== 'queued') {
      return;
    }
    if (!beginHandoff({ agentId })) {
      return;
    }
    writeAgentQueue({
      set,
      agentId,
      queue: current.map((item) => (item.id === itemId ? { ...item, status: 'sending' } : item)),
    });
    try {
      await get()
        .cancelCurrentTurn(sessionId, agentId, 'handoff')
        .catch(() => undefined);
      await waitTurnSettled({ agentId });
    } finally {
      endHandoff({ agentId });
    }
    await deliverQueuedTurn({ set, get, sessionId, turn: target, sentVia: 'interrupt' });
  };
};
