import type { AgentId, SessionId } from '@goodboy/types';
import { autoRetryRouteOf } from './autoRetryRouteOf';
import { resumeAfterRestart } from './resumeAfterRestart';
import { withStepBoundary } from './kickoff';
import type { GetFn } from './types';

const CONTINUE_STOPPED_MESSAGE = 'Continue from where you stopped.';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const continueStoppedAgent = (get: GetFn) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const autoRoute = autoRetryRouteOf({
      views: get().autoTreeViews[sessionId] ?? [],
      runs,
      agentId,
    });
    if (autoRoute !== null) {
      await get().sendTurn({
        sessionId,
        agentId: autoRoute.rootAgentId,
        content: autoRoute.message,
        origin: 'operator',
      });
      return;
    }
    const agent = runs.find((candidate) => candidate.id === agentId);
    if (agent?.stoppedBy === 'app') {
      const result = await resumeAfterRestart({ get, sessionId, agentId, reason: 'restart' });
      if (result !== 'unresumable') {
        return;
      }
    }
    await get().sendTurn({
      sessionId,
      agentId,
      content: withStepBoundary({ agent, text: CONTINUE_STOPPED_MESSAGE }),
      origin: 'operator',
    });
  };
};
