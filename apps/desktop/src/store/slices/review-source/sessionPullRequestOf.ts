import type { MountId, PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import type {
  GitlabMergeRequest,
  GitlabMrApprovalState,
} from '../../../features/integrations/gitlab/client';
import { mapBitbucketPrToPullRequestState } from '../../../features/integrations/bitbucket/mapBitbucketPrToPullRequestState';
import { mapMrToPullRequestState } from '../../../features/integrations/gitlab/mapMrToPullRequestState';
import type { AppState } from '../../types';
import { selectBitbucketRequest } from '../bitbucket-pr/selectBitbucketRequest';
import type { BitbucketRequest } from '../bitbucket-pr/selectBitbucketRequest';
import { selectActiveMountId } from '../project-mounts/selectors';

export type RequestState = Pick<
  AppState,
  | 'sessionGithub'
  | 'mountGitlabMr'
  | 'mountBitbucketPr'
  | 'sessions'
  | 'sessionProjectMounts'
  | 'sessionMounts'
  | 'sessionActiveMount'
  | 'sessionActiveProject'
>;

type Params = {
  readonly state: RequestState;
  readonly sessionId: SessionId;
  readonly mountId?: MountId | null;
  readonly prNumber?: number;
};

type Remembered = {
  readonly approvals: GitlabMrApprovalState | null;
  readonly pr: PullRequestState;
};

const REMEMBERED = new WeakMap<GitlabMergeRequest, Remembered>();

const gitlabRequestStateOf = ({
  mr,
  approvals,
}: {
  readonly mr: GitlabMergeRequest | null | undefined;
  readonly approvals: GitlabMrApprovalState | null | undefined;
}): PullRequestState | null => {
  if (mr == null) {
    return null;
  }
  const remembered = REMEMBERED.get(mr);
  if (remembered !== undefined && remembered.approvals === (approvals ?? null)) {
    return remembered.pr;
  }
  const pr = mapMrToPullRequestState({ mr, approvals: approvals ?? null });
  if (pr === null) {
    return null;
  }
  REMEMBERED.set(mr, { approvals: approvals ?? null, pr });
  return pr;
};

const REMEMBERED_BITBUCKET = new WeakMap<BitbucketRequest['pr'], BitbucketRemembered>();

type BitbucketRemembered = {
  readonly checks: BitbucketRequest['entry']['checks'];
  readonly reviewDecision: BitbucketRequest['entry']['reviewDecision'];
  readonly pr: PullRequestState;
};

const bitbucketRequestStateOf = (request: BitbucketRequest | null): PullRequestState | null => {
  if (request === null) {
    return null;
  }
  const { checks, reviewDecision } = request.entry;
  const remembered = REMEMBERED_BITBUCKET.get(request.pr);
  if (
    remembered !== undefined &&
    remembered.checks === checks &&
    remembered.reviewDecision === reviewDecision
  ) {
    return remembered.pr;
  }
  const pr = mapBitbucketPrToPullRequestState({ pr: request.pr, checks, reviewDecision });
  if (pr === null) {
    return null;
  }
  REMEMBERED_BITBUCKET.set(request.pr, { checks, reviewDecision, pr });
  return pr;
};

type HostRequest = {
  readonly host: PullRequestHost;
  readonly pr: PullRequestState | null;
};

const hostRequestOf = ({ state, sessionId, mountId, prNumber }: Params): HostRequest => {
  const github = state.sessionGithub?.[sessionId]?.pr ?? null;
  if (github !== null) {
    return { host: 'github', pr: github };
  }
  const id = mountId ?? selectActiveMountId({ state, sessionId });
  const gitlabEntry = id === null ? undefined : state.mountGitlabMr?.[id];
  const gitlab = gitlabRequestStateOf({ mr: gitlabEntry?.mr, approvals: gitlabEntry?.approvals });
  if (gitlab !== null) {
    return { host: 'gitlab', pr: gitlab };
  }
  const bitbucket = bitbucketRequestStateOf(
    selectBitbucketRequest({
      state,
      sessionId,
      ...(mountId == null ? {} : { mountId }),
      ...(prNumber === undefined ? {} : { prNumber }),
    }),
  );
  return bitbucket === null ? { host: 'github', pr: null } : { host: 'bitbucket', pr: bitbucket };
};

export const sessionPullRequestOf = (params: Params): PullRequestState | null =>
  hostRequestOf(params).pr;

export const sessionPullRequestHostOf = (params: Params): PullRequestHost =>
  hostRequestOf(params).host;
