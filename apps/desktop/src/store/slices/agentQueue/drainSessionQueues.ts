import type { SessionId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';

type Params = Readonly<{
  sessionId: SessionId;
}>;

export const drainSessionQueues = ({ get }: Pick<SliceDeps, 'get'>) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const state = get();
    const waiting = (state.sessionPhaseRuns[sessionId] ?? []).filter(
      (agent) => agent.status !== 'running' && (state.agentQueue[agent.id]?.length ?? 0) > 0,
    );
    await Promise.all(
      waiting.map((agent) => state.drainAgentQueue({ sessionId, agentId: agent.id })),
    );
  };
};
