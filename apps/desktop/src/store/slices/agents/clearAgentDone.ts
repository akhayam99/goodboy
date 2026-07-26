import type { AgentId, SessionId } from '@goodboy/types';
import { invokeAgentSetDone } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

export const clearAgentDone = (set: SetFn) => {
  return async (sessionId: SessionId, agentId: AgentId) => {
    set((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) => {
          if (agent.id !== agentId || agent.doneAt == null) {
            return agent;
          }
          const { doneAt: _, ...reopenedAgent } = agent;
          return reopenedAgent;
        }),
      },
    }));
    await invokeAgentSetDone(agentId, false, null);
  };
};
