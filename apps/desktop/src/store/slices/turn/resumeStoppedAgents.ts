import type { AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { isStoppedByRestart } from './isStoppedByRestart';
import type { GetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  workflowRunId?: WorkflowRunId;
}>;

const inFlight = new Set<AgentId>();

export const resumeStoppedAgents = (get: GetFn) => {
  return async ({ sessionId, workflowRunId }: Params): Promise<number> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const stopped = runs.filter(
      (agent) =>
        isStoppedByRestart({ agent, runs }) &&
        !inFlight.has(agent.id) &&
        (workflowRunId === undefined || agent.workflowRunId === workflowRunId),
    );
    for (const agent of stopped) {
      inFlight.add(agent.id);
    }
    const results = await Promise.allSettled(
      stopped.map(async (agent) => {
        try {
          await get().continueStoppedAgent({ sessionId, agentId: agent.id });
        } finally {
          inFlight.delete(agent.id);
        }
      }),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure !== undefined) {
      throw failure.reason;
    }
    return stopped.length;
  };
};
