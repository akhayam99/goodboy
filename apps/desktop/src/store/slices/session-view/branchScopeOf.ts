import type { SessionId } from '@goodboy/types';
import type { BranchScope } from '../../../features/branch/branchTabs';
import { pullRequestKindOf } from '../../../shared/pullRequestKind';
import type { AppState } from '../../types';
import { sessionPullRequestOf, type RequestState } from '../review-source/sessionPullRequestOf';

type ScopeState = RequestState & Pick<AppState, 'diffComments' | 'sessionResolveQueueItems'>;

type Params = {
  readonly state: ScopeState;
  readonly sessionId: SessionId;
  readonly hasThread?: boolean;
};

export const branchScopeOf = ({ state, sessionId, hasThread = false }: Params): BranchScope => {
  const pr = sessionPullRequestOf({ state, sessionId });
  return {
    state: pr === null ? 'none' : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    hasComments:
      hasThread ||
      (state.diffComments?.[sessionId] ?? []).length > 0 ||
      (state.sessionResolveQueueItems?.[sessionId] ?? []).length > 0,
  };
};
