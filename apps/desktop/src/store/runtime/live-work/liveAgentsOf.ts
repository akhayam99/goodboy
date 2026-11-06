import type { Agent, SessionId } from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import type { LiveWorkState } from './selectLiveWork';

type Params = {
  readonly state: Pick<LiveWorkState, 'sessionPhaseRuns' | 'agentTurnState'>;
  readonly sessionId: SessionId;
};

export const liveAgentsOf = ({ state, sessionId }: Params): ReadonlyArray<Agent> =>
  (state.sessionPhaseRuns[sessionId] ?? []).filter(
    (agent) =>
      agent.status === 'running' ||
      isTurnStateLive({ turnState: state.agentTurnState[agent.id], includeBlocked: true }),
  );
