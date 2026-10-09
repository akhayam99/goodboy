import type { SessionId } from '@goodboy/types';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import type { AppState } from '../../types';
import { sessionPullRequestOf, type RequestState } from '../review-source/sessionPullRequestOf';
import type { BranchTab } from '../navigation/types';

type State = Pick<AppState, 'branchTab'> & RequestState;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const branchHasPullRequest = ({
  state,
  sessionId,
}: {
  readonly state: RequestState;
  readonly sessionId: SessionId;
}): boolean => sessionPullRequestOf({ state, sessionId }) !== null;

export const branchTabOf = ({ state, sessionId }: Params): BranchTab =>
  state.branchTab?.[sessionId] ??
  branchLandingTabOf({
    hasPullRequest: branchHasPullRequest({ state, sessionId }),
    deepLink: null,
  });
