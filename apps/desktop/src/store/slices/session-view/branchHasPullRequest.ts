import type { SessionId } from '@goodboy/types';
import { sessionPullRequestOf, type RequestState } from '../review-source/sessionPullRequestOf';

type Params = {
  readonly state: RequestState;
  readonly sessionId: SessionId;
};

export const branchHasPullRequest = ({ state, sessionId }: Params): boolean =>
  sessionPullRequestOf({ state, sessionId }) !== null;
