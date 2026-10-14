import type { AgentId, SessionId } from '@goodboy/types';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { isHandoffPending } from './handoff';
import { readAgentQueue, writeAgentQueue } from './queueStore';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

const BUSY_TURN_KINDS: ReadonlySet<string> = new Set(['starting', 'running']);

export const drainAgentQueue = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    if (isHandoffPending({ agentId })) {
      return;
    }
    const state = get();
    if (BUSY_TURN_KINDS.has(state.agentTurnState[agentId]?.kind ?? 'idle')) {
      return;
    }
    const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((row) => row.id === agentId);
    if (agent?.status === 'stopped') {
      return;
    }
    const queue = readAgentQueue({ get, agentId });
    const head = queue[0];
    if (head === undefined || head.status === 'sending') {
      return;
    }
    writeAgentQueue({
      set,
      agentId,
      queue: queue.map((item) => (item.id === head.id ? { ...item, status: 'sending' } : item)),
    });
    await deliverQueuedTurn({ set, get, sessionId, turn: head, sentVia: 'queued' });
  };
};
