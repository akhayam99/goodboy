import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { PullRequestViewEntry } from './state';

const NO_MOUNT_KEY = 'none';

type KeyParams = {
  readonly mountId: MountId | null;
};

const pullRequestViewKeyOf = ({ mountId }: KeyParams): string => mountId ?? NO_MOUNT_KEY;

type AtParams = {
  readonly state: Pick<AppState, 'pullRequestViews'>;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number | null;
};

export const pullRequestViewAt = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: AtParams): PullRequestViewEntry | null => {
  if (prNumber === null) {
    return null;
  }
  const entry = state.pullRequestViews[sessionId]?.[pullRequestViewKeyOf({ mountId })];
  return entry !== undefined && entry.prNumber === prNumber ? entry : null;
};

type PutParams = {
  readonly views: AppState['pullRequestViews'];
  readonly sessionId: SessionId;
  readonly entry: PullRequestViewEntry;
};

export const withPullRequestViewEntry = ({
  views,
  sessionId,
  entry,
}: PutParams): AppState['pullRequestViews'] => ({
  ...views,
  [sessionId]: {
    ...views[sessionId],
    [pullRequestViewKeyOf({ mountId: entry.mountId })]: entry,
  },
});
