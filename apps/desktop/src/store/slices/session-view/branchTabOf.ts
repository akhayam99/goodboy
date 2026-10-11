import type { SessionId } from '@goodboy/types';
import { branchLandingTabOf } from '../../../features/branch/branchLandingTab';
import type { BranchScope } from '../../../features/branch/branchTabs';
import { pullRequestKindOf } from '../../../shared/pullRequestKind';
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

type ScopeState = RequestState & Pick<AppState, 'diffComments' | 'sessionResolveQueueItems'>;

export const branchScopeOf = ({
  state,
  sessionId,
  hasThread = false,
}: {
  readonly state: ScopeState;
  readonly sessionId: SessionId;
  readonly hasThread?: boolean;
}): BranchScope => {
  const pr = sessionPullRequestOf({ state, sessionId });
  return {
    state: pr === null ? 'none' : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    hasComments:
      hasThread ||
      (state.diffComments?.[sessionId] ?? []).length > 0 ||
      (state.sessionResolveQueueItems?.[sessionId] ?? []).length > 0,
  };
};

export const branchTabOf = ({ state, sessionId }: Params): BranchTab =>
  state.branchTab?.[sessionId] ??
  branchLandingTabOf({
    hasPullRequest: branchHasPullRequest({ state, sessionId }),
    deepLink: null,
  });
