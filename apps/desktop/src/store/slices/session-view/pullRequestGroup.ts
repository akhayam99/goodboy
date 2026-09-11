import type { PullRequestState, SessionPrGroup } from '@goodboy/types';

type ApprovalParams = {
  readonly pr: PullRequestState;
};

export const isPullRequestApproved = ({ pr }: ApprovalParams): boolean =>
  !pr.isDraft && (pr.state === 'approved' || pr.reviewDecision === 'approved');

type GroupParams = {
  readonly pr: PullRequestState | null | undefined;
};

export const pullRequestGroupOf = ({ pr }: GroupParams): SessionPrGroup => {
  if (pr == null) {
    return 'not-open';
  }
  if (pr.state === 'closed') {
    return 'closed';
  }
  if (pr.state === 'merged') {
    return 'merged';
  }
  if (pr.state === 'queued') {
    return 'queued';
  }
  if (pr.isDraft) {
    return 'draft';
  }
  if (isPullRequestApproved({ pr })) {
    return 'reviewed';
  }
  return 'reviewable';
};
