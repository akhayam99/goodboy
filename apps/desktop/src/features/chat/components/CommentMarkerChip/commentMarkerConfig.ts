import type { CommentMarker } from './commentMarker';

type Config = {
  readonly manageTestId: string;
  readonly dismissLabel: string;
};

export const COMMENT_MARKER_CONFIG = {
  analysis: {
    manageTestId: 'comment-analysis-manage',
    dismissLabel: 'dismiss this recommendation',
  },
  resolved: {
    manageTestId: 'comment-resolved-manage',
    dismissLabel: 'dismiss resolver status',
  },
  wontfix: {
    manageTestId: 'comment-wontfix-manage',
    dismissLabel: 'dismiss resolver status',
  },
} satisfies Record<CommentMarker['kind'], Config>;
