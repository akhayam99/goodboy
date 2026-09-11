import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessions' | 'sessionActiveMount'>;
  readonly sessionId: SessionId;
};

export const selectSelectedMountId = ({ state, sessionId }: Params): MountId | null => {
  const selected = state.sessionActiveMount?.[sessionId];
  if (selected !== undefined) {
    return selected;
  }
  const session = state.sessions?.find((candidate) => candidate.id === sessionId);
  return session?.activeMountId ?? null;
};
