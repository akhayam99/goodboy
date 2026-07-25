import type { DiffComment } from '@goodboy/types';

type Params = {
  readonly comment: DiffComment;
};

export const diffCommentLocation = ({ comment }: Params): string => {
  if (comment.anchor == null) {
    return comment.filePath;
  }
  return `${comment.filePath}:${comment.anchor.lineNumber}`;
};
