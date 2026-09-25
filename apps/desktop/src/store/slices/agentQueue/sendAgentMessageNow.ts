import type { SessionId } from '@goodboy/types';
import type { AgentQueuedTurnInput, GetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  turn: AgentQueuedTurnInput;
}>;

export const sendAgentMessageNow = (get: GetFn) => {
  return async ({ sessionId, turn }: Params): Promise<void> => {
    await get().enqueueAgentMessage({ turn, placement: 'first' });
    await get().sendQueuedNow({ sessionId, agentId: turn.agentId, itemId: turn.id });
  };
};
