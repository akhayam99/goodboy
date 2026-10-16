import type { SessionId, WorktreeStatus } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { distanceBehind, unmergedCount } from '../../../../../shared/lib/gitStatus';
import { mountReviewGithub } from '../../../../../features/review/mountReviewGithub';
import { eligibleReviewThreadCount } from '../../../../../features/suggestions/eligibleThreads';
import { worktreeRowStateOf, type WorktreeRowState } from '../worktreeRowStateOf';

type Params = {
  readonly sessionId: SessionId;
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
};

export const useWorktreeRowState = ({ sessionId, row, status }: Params): WorktreeRowState => {
  const request = row.request;
  const prNumber = request?.provider === 'github' ? request.number : null;
  const commentsWaiting = useAppStore((state) => {
    if (prNumber === null) {
      return 0;
    }
    const github = mountReviewGithub({ state, sessionId, mountId: row.mountId });
    if (github?.pr?.number !== prNumber) {
      return 0;
    }
    return eligibleReviewThreadCount({
      github,
      rows: state.sessionResolveThreads[sessionId] ?? EMPTY_ARRAY,
    });
  });
  return worktreeRowStateOf({
    checks: request?.checks ?? null,
    behind: status === null ? null : distanceBehind({ distance: status.mainDistance }),
    conflicts: status === null ? null : unmergedCount({ workingTree: status.workingTree }),
    isRebasing: status?.inProgress === 'rebase',
    isDecisionWaiting: row.observation !== null,
    commentsWaiting,
    baseBranch: row.baseBranch,
  });
};
