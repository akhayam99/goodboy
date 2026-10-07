import type { PrComment } from '@goodboy/types';

const EARLIER_COMMENT_NAME = 'A comment before this one';

export const staleCommentName = ({ head }: { readonly head: PrComment | null }): string => {
  if (head === null) {
    return EARLIER_COMMENT_NAME;
  }
  if (head.path !== undefined) {
    return `The comment on ${head.path}${head.line === undefined ? '' : `:${head.line}`}`;
  }
  return `The comment by ${head.author}`;
};
