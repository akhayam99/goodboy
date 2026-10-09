import type { MountId, PullRequestHost, SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import { activeReviewSourceOf, type ReviewSourceSelectionState } from './activeReviewSource';
import { sessionPullRequestHostOf, type RequestState } from './sessionPullRequestOf';

const mountHostOf = ({
  state,
  mountId,
}: {
  readonly state: Pick<AppState, 'mountGithub' | 'mountGitlabMr' | 'mountBitbucketPr'>;
  readonly mountId: MountId;
}): PullRequestHost | null => {
  const github = state.mountGithub?.[mountId];
  if (github != null && (github.pr !== null || (github.prs ?? []).length > 0)) {
    return 'github';
  }
  if (state.mountGitlabMr?.[mountId]?.mr != null) {
    return 'gitlab';
  }
  const bitbucket = state.mountBitbucketPr?.[mountId];
  if (
    bitbucket != null &&
    bitbucket.repo !== null &&
    (bitbucket.pr !== null || bitbucket.prs.length > 0)
  ) {
    return 'bitbucket';
  }
  return null;
};

type Params = Readonly<{
  state: ReviewSourceSelectionState & RequestState;
  sessionId: SessionId;
  mountId?: MountId;
}>;

export const requestHostOf = ({ state, sessionId, mountId }: Params): PullRequestHost =>
  (mountId === undefined ? null : mountHostOf({ state, mountId })) ??
  activeReviewSourceOf({ state, sessionId })?.kind ??
  sessionPullRequestHostOf({ state, sessionId, ...(mountId === undefined ? {} : { mountId }) });
