import type { CommentMarker } from './commentMarker';

type Config = {
  readonly openTestId: string;
  readonly openLabel: string;
};

export const COMMENT_MARKER_CONFIG = {
  analysis: {
    openTestId: 'comment-analysis-open',
    openLabel: 'Open the chat of this resolver',
  },
  resolved: {
    openTestId: 'comment-resolved-open',
    openLabel: 'Open the chat of this resolver',
  },
  wontfix: {
    openTestId: 'comment-wontfix-open',
    openLabel: 'Open the chat of this resolver',
  },
} satisfies Record<CommentMarker['kind'], Config>;
