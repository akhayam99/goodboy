import type { Agent, SessionId } from '@goodboy/types';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

export const addAgent = ({ store, sessionId, agent }: Params): void => {
  store.setState((state) => {
    const agents = state.sessionPhaseRuns[sessionId] ?? [];
    if (agents.some((entry) => entry.id === agent.id)) {
      return {};
    }
    return { sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: [...agents, agent] } };
  });
};
