import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { persistOrchestrationStop } from '../workflows/orchestrateNextStep';
import { sessionById } from '../sessions/sessionIndex';
import { autoRetryRouteOf } from './autoRetryRouteOf';
import { resumeAfterRestart } from './resumeAfterRestart';
import { withStepBoundary } from './kickoff';
import { throwIfRefused } from './throwIfRefused';
import type { GetFn, SetFn } from './types';

const CONTINUE_STOPPED_MESSAGE = 'Continue from where you stopped.';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

type ReleaseParams = Readonly<{
  set: SetFn;
  get: GetFn;
  sessionId: SessionId;
  agent: Agent | undefined;
}>;

const releaseOperatorStop = async ({ set, get, sessionId, agent }: ReleaseParams) => {
  const workflowRunId = agent?.workflowRunId ?? null;
  if (workflowRunId === null) {
    return;
  }
  const run = sessionById(get().sessions, sessionId)?.workflowRuns.find(
    (candidate) => candidate.id === workflowRunId,
  );
  if (run?.orchestrationStop?.kind !== 'operator') {
    return;
  }
  await persistOrchestrationStop({ set, sessionId, workflowRunId, stop: null });
};

export const continueStoppedAgent = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, agentId }: Params): Promise<void> => {
    const runs = get().sessionPhaseRuns[sessionId] ?? [];
    const autoRoute = autoRetryRouteOf({
      views: get().autoTreeViews[sessionId] ?? [],
      runs,
      agentId,
    });
    if (autoRoute !== null) {
      throwIfRefused({
        result: await get().sendTurn({
          sessionId,
          agentId: autoRoute.rootAgentId,
          content: autoRoute.message,
          origin: 'operator',
        }),
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
    await releaseOperatorStop({ set, get, sessionId, agent });
    throwIfRefused({
      result: await get().sendTurn({
        sessionId,
        agentId,
        content: withStepBoundary({ agent, text: CONTINUE_STOPPED_MESSAGE }),
        origin: 'operator',
      }),
    });
  };
};
