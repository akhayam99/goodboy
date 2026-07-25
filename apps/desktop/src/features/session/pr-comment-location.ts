import type { PrComment } from '@goodboy/types';

type Params = {
  readonly comment: PrComment;
};

export const prCommentLocation = ({ comment }: Params): string | null => {
  if (comment.source === 'issue') {
    return 'conversation';
  }
  if (comment.path == null) {
    return null;
  }
  return comment.line != null ? `${comment.path}:${comment.line}` : comment.path;
};
