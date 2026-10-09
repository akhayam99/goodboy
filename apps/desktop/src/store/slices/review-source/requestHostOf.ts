import type { MountId, PullRequestHost, SessionId } from '@goodboy/types';
import { activeReviewSourceOf, type ReviewSourceSelectionState } from './activeReviewSource';
import { sessionPullRequestHostOf, type RequestState } from './sessionPullRequestOf';

type Params = Readonly<{
  state: ReviewSourceSelectionState & RequestState;
  sessionId: SessionId;
  mountId?: MountId;
}>;

export const requestHostOf = ({ state, sessionId, mountId }: Params): PullRequestHost =>
  activeReviewSourceOf({ state, sessionId })?.kind ??
  sessionPullRequestHostOf({ state, sessionId, ...(mountId === undefined ? {} : { mountId }) });
