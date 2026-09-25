import type { ReviewMode } from './reviewMode';

export const REVIEW_MODE_LABEL = {
  queue: null,
  pr_details: 'PR details',
  pr_activity: 'PR activity',
  checks: 'Checks',
  create_pr: 'New pull request',
  write_review: 'Write review',
} satisfies Readonly<Record<ReviewMode, string | null>>;
