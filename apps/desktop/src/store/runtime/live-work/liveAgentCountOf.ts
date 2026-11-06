import { brandId, type ProviderRunId, type SessionId } from '@goodboy/types';
import { isKeptWait } from './isKeptWait';
import { liveAgentsOf } from './liveAgentsOf';
import type { LiveWorkState } from './selectLiveWork';

type Params = {
  readonly state: Pick<LiveWorkState, 'sessionPhaseRuns' | 'agentTurnState'>;
  readonly keptRuns: ReadonlySet<ProviderRunId>;
};

export const liveAgentCountOf = ({ state, keptRuns }: Params): number =>
  Object.keys(state.sessionPhaseRuns).reduce(
    (total, key) =>
      total +
      liveAgentsOf({ state, sessionId: brandId<SessionId>({ value: key }) }).filter(
        (agent) => !isKeptWait({ turnState: state.agentTurnState[agent.id], keptRuns }),
      ).length,
    0,
  );
