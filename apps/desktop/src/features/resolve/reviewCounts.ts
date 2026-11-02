import type { PrComment } from '@goodboy/types';
import { commentsCountOf } from './commentsCountOf';

export type ReviewCounts = {
  readonly threads: number;
  readonly comments: number;
  readonly unresolved: number;
  readonly needYou: number;
  readonly unread: number;
};

type Params = {
  readonly threads: Parameters<typeof commentsCountOf>[0]['threads'];
  readonly comments?: ReadonlyArray<Pick<PrComment, 'source'>> | null;
  readonly unread?: ReadonlyArray<{ readonly threadId: string }> | null;
};

export const reviewCounts = ({ threads, comments = null, unread = null }: Params): ReviewCounts => {
  const { unresolved, needsYou } = commentsCountOf({ threads });
  return {
    threads: threads.length,
    comments: comments?.filter((comment) => comment.source === 'review').length ?? 0,
    unresolved,
    needYou: needsYou,
    unread: unread?.length ?? 0,
  };
};
