import type { AgentId, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

export const CONTINUE_STOPPED_MESSAGE = 'Continue from where you stopped.';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const continueStoppedAgent = (get: GetFn) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    await get().sendTurn({
      sessionId,
      agentId,
      content: CONTINUE_STOPPED_MESSAGE,
      origin: 'operator',
    });
  };
};
