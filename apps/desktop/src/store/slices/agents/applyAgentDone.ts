import type { AgentId, IsoDateTime, SessionId } from '@goodboy/types';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly doneAt: IsoDateTime | null;
};

export const applyAgentDone = ({ set, sessionId, agentId, doneAt }: Params): void => {
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) => {
        if (agent.id !== agentId) {
          return agent;
        }
        if (doneAt === null) {
          const { doneAt: _cleared, ...reopenedAgent } = agent;
          return reopenedAgent;
        }
        return { ...agent, doneAt };
      }),
    },
  }));
};
