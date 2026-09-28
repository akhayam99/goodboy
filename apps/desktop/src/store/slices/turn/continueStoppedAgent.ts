import type { AgentId, SessionId } from '@goodboy/types';
import { resumeAfterRestart } from './resumeAfterRestart';
import type { GetFn } from './types';

export const CONTINUE_STOPPED_MESSAGE = 'Continue from where you stopped.';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const continueStoppedAgent = (get: GetFn) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    const agent = (get().sessionPhaseRuns[sessionId] ?? []).find(
      (candidate) => candidate.id === agentId,
    );
    if (agent?.stoppedBy === 'app') {
      const result = await resumeAfterRestart({ get, sessionId, agentId, reason: 'restart' });
      if (result !== 'unresumable') {
        return;
      }
    }
    await get().sendTurn({
      sessionId,
      agentId,
      content: CONTINUE_STOPPED_MESSAGE,
      origin: 'operator',
    });
  };
};
