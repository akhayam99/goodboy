import type { MountId, PullRequestView, SessionId } from '@goodboy/types';
import { pullRequestViewAt } from '../../store/slices/pull-request-view/pullRequestViewAt';
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
  return pullRequestViewAt({ state, sessionId, mountId, prNumber })?.view ?? null;
};
