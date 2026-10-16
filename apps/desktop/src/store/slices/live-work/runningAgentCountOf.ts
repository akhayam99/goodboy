import type { SessionId } from '@goodboy/types';
import { isTurnStateLive } from '../../../features/session/agent-lifecycle';
import type { LiveWorkState } from './selectLiveWork';

type Params = {
  readonly state: Pick<LiveWorkState, 'sessionPhaseRuns' | 'agentTurnState'>;
  readonly sessionId: SessionId;
};

export const runningAgentCountOf = ({ state, sessionId }: Params): number =>
  (state.sessionPhaseRuns[sessionId] ?? []).filter(
    (run) =>
      run.status === 'running' || isTurnStateLive({ turnState: state.agentTurnState[run.id] }),
  ).length;
