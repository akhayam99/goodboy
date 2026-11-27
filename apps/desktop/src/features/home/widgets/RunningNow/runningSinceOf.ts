import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../../../store/types';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'agentTurnState'>;
  readonly sessionId: SessionId;
};

export const runningSinceOf = ({ state, sessionId }: Params): number | null => {
  const times = (state.sessionPhaseRuns[sessionId] ?? []).flatMap((agent) => {
    const turn = state.agentTurnState[agent.id];
    if (turn?.kind !== 'running') {
      return [];
    }
    const at = Date.parse(turn.startedAt);
    return Number.isNaN(at) ? [] : [at];
  });
  return times.length === 0 ? null : Math.min(...times);
};
