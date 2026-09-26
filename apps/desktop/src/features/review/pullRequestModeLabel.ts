import type { PullRequestMode } from './pullRequestMode';

export const PULL_REQUEST_MODE_LABEL = {
  overview: null,
  create_pr: 'New',
  write_review: 'Write review',
} satisfies Readonly<Record<PullRequestMode, string | null>>;
