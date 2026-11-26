import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionPhaseRuns' | 'agentTurnDestination'>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const isMountInUse = ({ state, sessionId, mountId }: Params): boolean =>
  (state.sessionPhaseRuns?.[sessionId] ?? []).some((agent) => {
    if (agent.status !== 'running' && agent.status !== 'blocked') {
      return false;
    }
    const destination = state.agentTurnDestination?.[agent.id] ?? null;
    return destination !== null && destination.kind === 'mount' && destination.mountId === mountId;
  });
