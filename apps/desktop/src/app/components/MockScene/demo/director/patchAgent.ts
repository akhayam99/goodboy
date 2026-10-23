import type { Agent, AgentId, SessionId } from '@goodboy/types';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly patch: Partial<Agent>;
};

export const patchAgent = ({ store, sessionId, agentId, patch }: Params): void => {
  store.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) =>
        agent.id === agentId ? { ...agent, ...patch } : agent,
      ),
    },
  }));
};
