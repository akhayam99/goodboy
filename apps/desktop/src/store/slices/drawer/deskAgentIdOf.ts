import type { AgentId, SessionId } from '@goodboy/types';
import type { DrawerSliceState } from './state';

type Params = {
  readonly state: Partial<Pick<DrawerSliceState, 'drawer' | 'drawerBack'>>;
  readonly sessionId: SessionId;
};

export const deskAgentIdOf = ({ state, sessionId }: Params): AgentId | null => {
  for (const entry of [state.drawer ?? null, state.drawerBack ?? null]) {
    if (entry !== null && entry.kind === 'transcript' && entry.sessionId === sessionId) {
      return entry.payload.agentId;
    }
  }
  return null;
};
