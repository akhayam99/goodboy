import type { SessionId } from '@goodboy/types';
import type { LiveWorkState } from './selectLiveWork';
import { runningAgentsOf } from './runningAgentsOf';

type Params = {
  readonly state: Pick<LiveWorkState, 'sessionPhaseRuns' | 'agentTurnState'>;
  readonly sessionId: SessionId;
};

export const runningAgentCountOf = ({ state, sessionId }: Params): number =>
  runningAgentsOf({ state, sessionId }).length;
