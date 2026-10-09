import type { MountId, PullRequestHost, PullRequestState, SessionId } from '@goodboy/types';
import type {
  GitlabMergeRequest,
  GitlabMrApprovalState,
} from '../../../features/integrations/gitlab/client';
import { mapMrToPullRequestState } from '../../../features/integrations/gitlab/mapMrToPullRequestState';
import type { AppState } from '../../types';
import { selectActiveMountId } from '../project-mounts/selectors';

export type RequestState = Pick<
  AppState,
  | 'sessionGithub'
  | 'mountGitlabMr'
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

export const sessionPullRequestOf = ({
  state,
  sessionId,
  mountId,
}: Params): PullRequestState | null => {
  const github = state.sessionGithub?.[sessionId]?.pr ?? null;
  if (github !== null) {
    return github;
  }
  const id = mountId ?? selectActiveMountId({ state, sessionId });
  const gitlab = id === null ? undefined : state.mountGitlabMr?.[id];
  return gitlabRequestStateOf({ mr: gitlab?.mr, approvals: gitlab?.approvals });
};

export const sessionPullRequestHostOf = ({ state, sessionId, mountId }: Params): PullRequestHost =>
  (state.sessionGithub?.[sessionId]?.pr ?? null) === null &&
  sessionPullRequestOf({ state, sessionId, mountId }) !== null
    ? 'gitlab'
    : 'github';
