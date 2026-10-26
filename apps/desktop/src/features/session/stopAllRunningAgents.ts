import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { runningAgentsOf } from '../../store/runtime/live-work/runningAgentsOf';

export type StopAllResult = Readonly<{
  stopped: number;
  stillRunning: number;
}>;

type StopAllState = Pick<
  AppStore,
  'sessionPhaseRuns' | 'agentTurnState' | 'cancelTurnConfirmed' | 'reportError'
>;

type Params = {
  readonly getState: () => StopAllState;
  readonly sessionId: SessionId;
};

export const stopAllRunningAgents = async ({
  getState,
  sessionId,
}: Params): Promise<StopAllResult> => {
  const agents = runningAgentsOf({ state: getState(), sessionId }).map((agent) => ({
    id: agent.id,
    hadLiveTurn: getState().agentTurnState[agent.id]?.kind === 'running',
  }));
  const settled = await Promise.allSettled(
    agents.map((agent) =>
      getState().cancelTurnConfirmed({ sessionId, agentId: agent.id, reason: 'user' }),
    ),
  );
  let stopped = 0;
  let stillRunning = 0;
  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === 'rejected') {
      stillRunning += 1;
      void getState().reportError({
        title: "Couldn't stop the agent",
        error: outcome.reason,
        sessionId,
      });
      continue;
    }
    if (outcome.value.outcome !== 'exited') {
      stillRunning += 1;
      continue;
    }
    if (agents[index]?.hadLiveTurn === true) {
      stopped += 1;
    }
  }
  return { stopped, stillRunning };
};
