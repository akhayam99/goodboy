import type { PullRequestReviewerState } from '@goodboy/types';

export const REVIEWER_STATE_TEXT: Readonly<Record<PullRequestReviewerState, string>> = {
  approved: 'text-success',
  changes_requested: 'text-danger',
  commented: 'text-muted-foreground',
  pending: 'text-muted-foreground',
  dismissed: 'text-muted-foreground',
};
