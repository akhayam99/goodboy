import type { MountId, SessionId } from '@goodboy/types';
import type { AppState, SessionGithubState } from '../../store/types';
import { selectActiveMountId } from '../../store/slices/project-mounts/selectors';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const mountReviewGithub = ({
  state,
  sessionId,
  mountId,
}: Params): SessionGithubState | null => {
  const own = state.mountGithub[mountId] ?? null;
  if (own?.detail != null) {
    return own;
  }
  return selectActiveMountId({ state, sessionId }) === mountId
    ? (state.sessionGithub[sessionId] ?? null)
    : null;
};
