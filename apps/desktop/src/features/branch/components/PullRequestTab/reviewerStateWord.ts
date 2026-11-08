import type { PullRequestReviewerState } from '@goodboy/types';

export const REVIEWER_STATE_WORD: Readonly<Record<PullRequestReviewerState, string>> = {
  approved: 'Approved',
  changes_requested: 'Changes',
  commented: 'Commented',
  pending: 'Asked',
  dismissed: 'Dismissed',
};
