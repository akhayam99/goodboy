import type { PullRequestReviewerState } from '@goodboy/types';

export const REVIEWER_STATE_WORD: Readonly<Record<PullRequestReviewerState, string>> = {
  approved: 'Approved',
  changes_requested: 'Asked for changes',
  commented: 'Commented',
  pending: 'Not yet reviewed',
  dismissed: 'Dismissed',
};
