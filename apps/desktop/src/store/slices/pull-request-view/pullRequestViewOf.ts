import type { MountId, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { entryMountIdOf } from './entryMountId';
import { pullRequestViewAt } from './pullRequestViewAt';
import type { PullRequestViewEntry } from './state';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly prNumber: number | null;
};

export const pullRequestViewOf = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): PullRequestViewEntry | null =>
  pullRequestViewAt({
    state,
    sessionId,
    mountId: entryMountIdOf({ state, sessionId, mountId: mountId ?? undefined }),
    prNumber,
  });
