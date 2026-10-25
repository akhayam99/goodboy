import type { MountId, PullRequestState, SessionId, SessionProjectMount } from '@goodboy/types';
import type { BranchScope } from '../../../features/branch/branchTabs';
import { isNoteOnBranch } from '../../../features/resolve/notes/noteThread';
import { pullRequestKindOf } from '../../../shared/utils/pullRequestKind';
import type { AppState } from '../../types';
import { selectMountById } from '../project-mounts/selectors';
import { sessionPullRequestOf, type RequestState } from '../review-source/sessionPullRequestOf';

type ScopeState = RequestState &
  Pick<AppState, 'diffComments' | 'sessionResolveQueueItems' | 'mountBranchObservations'>;

type Params = {
  readonly state: ScopeState;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly hasThread?: boolean;
};

type CommentsParams = {
  readonly state: ScopeState;
  readonly sessionId: SessionId;
  readonly mount: SessionProjectMount;
  readonly pr: PullRequestState | null;
};

const hasCommentsOnMount = ({ state, sessionId, mount, pr }: CommentsParams): boolean => {
  const hasNote = (state.diffComments?.[sessionId] ?? []).some((note) =>
    isNoteOnBranch({ note, projectId: mount.projectId, branch: mount.branch }),
  );
  if (hasNote) {
    return true;
  }
  return (state.sessionResolveQueueItems?.[sessionId] ?? []).some(({ thread }) => {
    if (thread.originKind === 'diff_comment') {
      return false;
    }
    if (thread.projectId !== null && thread.projectId !== mount.projectId) {
      return false;
    }
    return pr === null || thread.prNumber === null || thread.prNumber === pr.number;
  });
};

export const branchScopeOf = ({
  state,
  sessionId,
  mountId,
  hasThread = false,
}: Params): BranchScope => {
  const pr = sessionPullRequestOf({ state, sessionId, mountId });
  const mount = mountId === null ? null : selectMountById({ state, sessionId, mountId });
  const hasSessionComments =
    (state.diffComments?.[sessionId] ?? []).length > 0 ||
    (state.sessionResolveQueueItems?.[sessionId] ?? []).length > 0;
  return {
    state: pr === null ? 'none' : pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
    hasComments:
      hasThread ||
      (mount === null
        ? hasSessionComments
        : hasSessionComments && hasCommentsOnMount({ state, sessionId, mount, pr })),
  };
};
