import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import { invokeAgentSetDone } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export const setAgentDone = (set: SetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    const doneAt = new Date().toISOString() as IsoDateTime;
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
          agent.id === agentId ? { ...agent, doneAt } : agent,
        ),
      },
    }));
    await invokeAgentSetDone(agentId, true);
  };
};
