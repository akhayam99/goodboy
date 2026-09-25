import type { SessionId } from '@goodboy/types';
import { waitTurnSettled } from '../turn/turnSettled';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { beginHandoff, endHandoff } from './handoff';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
import type { AgentQueueItemParams, GetFn, SetFn } from './types';

type SendQueuedParams = AgentQueueItemParams &
  Readonly<{
    sessionId: SessionId;
  }>;

export const sendQueuedNow = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId, itemId }: SendQueuedParams): Promise<void> => {
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
      writeAgentQueue({
        set,
        agentId,
        queue: readAgentQueue({ get, agentId }).filter((item) => item.id !== itemId),
      });
      void persistAgentQueue({ get, agentId });
      endHandoff({ agentId });
    }
    const delivery = await deliverQueuedTurn({
      get,
      sessionId,
      turn: target,
      sentVia: 'interrupt',
    });
    if (delivery === 'delivered') {
      return;
    }
    writeAgentQueue({ set, agentId, queue: [target, ...readAgentQueue({ get, agentId })] });
    await persistAgentQueue({ get, agentId });
  };
};
