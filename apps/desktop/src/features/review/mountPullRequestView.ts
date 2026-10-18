import type { MountId, PullRequestView, SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';

type Params = {
  readonly state: Pick<AppState, 'pullRequestViews'>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prNumber: number | null;
};

export const mountPullRequestView = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): PullRequestView | null => {
  const entry = state.pullRequestViews[sessionId];
  if (entry === undefined || prNumber === null || entry.prNumber !== prNumber) {
    return null;
  }
  return entry.mountId === null || entry.mountId === mountId ? entry.view : null;
};
