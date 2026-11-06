import type { AgentId, SessionId } from '@goodboy/types';
import { openPermissionAsksOf } from '../../../features/permissions/openPermissionAsksOf';
import { deliverQueuedTurn } from './deliverQueuedTurn';
import { isAgentStopping } from '../turn/stoppingAgents';
import { isHandoffPending } from './handoff';
import { isQueueParked } from './isQueueParked';
import { readAgentQueue, writeAgentQueue } from './queueStore';
import type { GetFn, SetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

type AskHoldParams = Params &
  Readonly<{
    get: GetFn;
  }>;

const BUSY_TURN_KINDS: ReadonlySet<string> = new Set(['starting', 'running']);

const isAskHoldingQueue = async ({ get, sessionId, agentId }: AskHoldParams): Promise<boolean> => {
  if (get().agentTurnState[agentId]?.kind !== 'blocked') {
    return false;
  }
  if (get().transcripts[agentId] === undefined) {
    await get()
      .loadAgentTranscript(sessionId, agentId, { isSelecting: false })
      .catch((error: unknown) =>
        get().reportError({ title: "Couldn't read the agent's chat", error, sessionId }),
      );
  }
  const hasOpenAsk = (): boolean => {
    const { transcripts, agentTurnState } = get();
    const events = transcripts[agentId];
    return (
      events === undefined ||
      openPermissionAsksOf({ events, turnState: agentTurnState[agentId] }).length > 0
    );
  };
  if (!hasOpenAsk()) {
    return false;
  }
  await get().refreshAgentAsks({ sessionId, agentId });
  return hasOpenAsk();
};

export const drainAgentQueue = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    if (isHandoffPending({ agentId }) || isAgentStopping({ agentId })) {
      return;
    }
    if (await isAskHoldingQueue({ get, sessionId, agentId })) {
      return;
    }
    const state = get();
    if (BUSY_TURN_KINDS.has(state.agentTurnState[agentId]?.kind ?? 'idle')) {
      return;
    }
    const agent = (state.sessionPhaseRuns[sessionId] ?? []).find((row) => row.id === agentId);
    if (isQueueParked({ agent })) {
      return;
    }
    const queue = readAgentQueue({ get, agentId });
    const head = queue[0];
    if (
      head === undefined ||
      head.hold !== undefined ||
      queue.some((item) => item.status === 'sending')
    ) {
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
