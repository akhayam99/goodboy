import type { SessionId } from '@goodboy/types';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import type { AppState } from '../../types';
import type { RequestState } from '../review-source/sessionPullRequestOf';
import type { BranchTab } from '../navigation/types';
import { branchHasPullRequest } from './branchHasPullRequest';

type State = Pick<AppState, 'branchTab'> & RequestState;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
};

export const branchTabOf = ({ state, sessionId }: Params): BranchTab =>
  state.branchTab?.[sessionId] ??
  branchLandingTabOf({
    hasPullRequest: branchHasPullRequest({ state, sessionId }),
    deepLink: null,
  });
