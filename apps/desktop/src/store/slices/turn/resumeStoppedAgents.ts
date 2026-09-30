import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { isStoppedByRestart } from './isStoppedByRestart';
import type { GetFn } from './types';

type Params = Readonly<{
  sessionId: SessionId;
  workflowRunId?: WorkflowRunId;
}>;

export const resumeStoppedAgents = (get: GetFn) => {
  return async ({ sessionId, workflowRunId }: Params): Promise<number> => {
    const stopped = (get().sessionPhaseRuns[sessionId] ?? []).filter(
      (agent) =>
        isStoppedByRestart({ agent }) &&
        (workflowRunId === undefined || agent.workflowRunId === workflowRunId),
    );
    const results = await Promise.allSettled(
      stopped.map((agent) => get().continueStoppedAgent({ sessionId, agentId: agent.id })),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure !== undefined) {
      throw failure.reason;
    }
    return stopped.length;
  };
};
