import type { CommentThread } from '../github/comment-threads';
import type { ResolveQueueRow } from './buildResolveQueueRows';

export const resolvableThread = ({
  row,
}: {
  readonly row: ResolveQueueRow;
}): CommentThread | null => {
  const thread = row.commentThread;
  if (thread === null || thread.head.resolved !== false) {
    return null;
  }
  if (row.thread.state !== 'open' && row.thread.state !== 'failed') {
    return null;
  }
  return thread;
};
