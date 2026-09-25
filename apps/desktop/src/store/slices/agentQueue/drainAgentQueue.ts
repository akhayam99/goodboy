import type { AgentId, SessionId } from '@goodboy/types';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { isHandoffPending } from './handoff';
import { persistAgentQueue, readAgentQueue, writeAgentQueue } from './queueStore';
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
    const [head, ...rest] = readAgentQueue({ get, agentId });
    if (head === undefined || head.status === 'sending') {
      return;
    }
    writeAgentQueue({ set, agentId, queue: rest });
    void persistAgentQueue({ get, agentId });
    const delivery = await deliverQueuedTurn({ get, sessionId, turn: head, sentVia: 'queued' });
    if (delivery === 'delivered') {
      return;
    }
    writeAgentQueue({ set, agentId, queue: [head, ...readAgentQueue({ get, agentId })] });
    await persistAgentQueue({ get, agentId });
  };
};
