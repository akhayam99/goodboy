import type { PrComment } from '@goodboy/types';
import { groupThreads } from '../../../features/github/comment-threads';

type Params = {
  readonly comments: ReadonlyArray<PrComment>;
};

export const openReviewThreadIds = ({ comments }: Params): ReadonlyArray<string> =>
  groupThreads(comments.filter((comment) => comment.source === 'review')).flatMap((thread) =>
    thread.head.resolved === false &&
    thread.head.threadId !== undefined &&
    thread.head.threadId !== ''
      ? [thread.head.threadId]
      : [],
  );
