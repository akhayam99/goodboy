import { brandId, type SessionId } from '@goodboy/types';
import { liveAgentsOf } from './liveAgentsOf';
import type { LiveWorkState } from './selectLiveWork';

type Params = {
  readonly state: Pick<LiveWorkState, 'sessionPhaseRuns' | 'agentTurnState'>;
};

export const liveAgentCountOf = ({ state }: Params): number =>
  Object.keys(state.sessionPhaseRuns).reduce(
    (total, key) =>
      total + liveAgentsOf({ state, sessionId: brandId<SessionId>({ value: key }) }).length,
    0,
  );
