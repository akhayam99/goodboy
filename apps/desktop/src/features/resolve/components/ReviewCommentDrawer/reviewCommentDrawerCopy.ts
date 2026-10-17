type PositionParams = {
  readonly index: number;
  readonly total: number;
};

export const REVIEW_COMMENT_DRAWER_COPY = {
  fallbackTitle: 'Comment',
  retry: 'Retry',
  gone: 'This comment is no longer on the pull request.',
  position: ({ index, total }: PositionParams): string => `${index + 1} of ${total}`,
} as const;
