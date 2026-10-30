import type { Agent } from '@goodboy/types';
import type { SetFn } from '../types';

type Params = Readonly<{
  set: SetFn;
  agent: Agent;
}>;

export const placeAgent = ({ set, agent }: Params): void => {
  set((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [agent.sessionId]: (state.sessionPhaseRuns[agent.sessionId] ?? []).map((candidate) =>
        candidate.id === agent.id ? agent : candidate,
      ),
    },
  }));
};
