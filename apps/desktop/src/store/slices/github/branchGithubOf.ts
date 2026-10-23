import type { MountId, SessionId } from '@goodboy/types';
import type { AppState, SessionGithubState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionGithub' | 'mountGithub'>;
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
};

export const branchGithubOf = ({
  state,
  sessionId,
  mountId,
}: Params): SessionGithubState | null => {
  if (mountId == null) {
    return state.sessionGithub?.[sessionId] ?? null;
  }
  return state.mountGithub?.[mountId] ?? null;
};
