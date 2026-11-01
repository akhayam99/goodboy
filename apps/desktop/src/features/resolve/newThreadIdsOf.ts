import type { ResolveThread } from '@goodboy/types';
import type { CommentThread } from '../integrations/github/comment-threads';
import { isOpenThread } from './isOpenThread';

type ThreadFacts = {
  readonly thread: Pick<ResolveThread, 'threadId' | 'stage' | 'originKind'>;
  readonly commentThread: CommentThread | null;
};

type Params = {
  readonly entries: ReadonlyArray<ThreadFacts>;
  readonly reads: Readonly<Record<string, number>>;
  readonly viewerLogins: ReadonlySet<string>;
};

type LatestParams = {
  readonly commentThread: CommentThread | null;
  readonly viewerLogins: ReadonlySet<string>;
};

const latestOtherMsOf = ({ commentThread, viewerLogins }: LatestParams): number | null => {
  if (commentThread === null) {
    return null;
  }
  const times = [commentThread.head, ...commentThread.replies]
    .filter((comment) => !viewerLogins.has(comment.author.toLowerCase()))
    .map((comment) => Date.parse(comment.createdAt))
    .filter((time) => Number.isFinite(time));
  return times.length === 0 ? null : Math.max(...times);
};

export const newThreadIdsOf = ({ entries, reads, viewerLogins }: Params): ReadonlySet<string> => {
  const ids = entries
    .filter(({ thread }) => thread.originKind !== 'diff_comment' && isOpenThread({ thread }))
    .filter(({ thread, commentThread }) => {
      const readAt = reads[thread.threadId];
      if (readAt === undefined) {
        return true;
      }
      const latestOtherMs = latestOtherMsOf({ commentThread, viewerLogins });
      return latestOtherMs !== null && latestOtherMs > readAt;
    })
    .map(({ thread }) => thread.threadId);
  return new Set(ids);
};
