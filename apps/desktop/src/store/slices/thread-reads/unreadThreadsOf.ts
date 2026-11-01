import type { PrComment, ResolveThread } from '@goodboy/types';
import { isOpenThread } from '../../../features/resolve/isOpenThread';
import {
  groupThreads,
  type CommentThread,
} from '../../../features/integrations/github/comment-threads';
import { rowBelongsToSource } from '../review-source/rowBelongsToSource';
import type { ReviewSourceEntry } from '../review-source/types';

export type UnreadThread = {
  readonly threadId: string;
  readonly latestOtherMs: number | null;
};

type Params = {
  readonly threads: ReadonlyArray<ResolveThread>;
  readonly comments: ReadonlyArray<PrComment>;
  readonly entry: Pick<ReviewSourceEntry, 'kind' | 'projectId' | 'number'> | null;
  readonly reads: Readonly<Record<string, number>> | undefined;
  readonly viewerLogins: ReadonlySet<string> | null;
};

type OthersParams = {
  readonly commentThread: CommentThread;
  readonly viewerLogins: ReadonlySet<string>;
};

const othersOf = ({ commentThread, viewerLogins }: OthersParams): ReadonlyArray<PrComment> =>
  [commentThread.head, ...commentThread.replies].filter(
    (comment) => !viewerLogins.has(comment.author.toLowerCase()),
  );

type LatestParams = {
  readonly comments: ReadonlyArray<PrComment>;
};

const latestMsOf = ({ comments }: LatestParams): number | null => {
  const times = comments
    .map((comment) => Date.parse(comment.createdAt))
    .filter((time) => Number.isFinite(time));
  return times.length === 0 ? null : Math.max(...times);
};

export const unreadThreadsOf = ({
  threads,
  comments,
  entry,
  reads,
  viewerLogins,
}: Params): ReadonlyArray<UnreadThread> | null => {
  if (reads === undefined || viewerLogins === null) {
    return null;
  }
  if (entry === null) {
    return [];
  }
  const commentThreads = new Map(
    groupThreads(comments.filter((comment) => comment.source === 'review')).flatMap((thread) =>
      thread.head.threadId == null ? [] : [[thread.head.threadId, thread] as const],
    ),
  );
  return threads
    .filter(
      (thread) =>
        thread.originKind !== 'diff_comment' &&
        isOpenThread({ thread }) &&
        rowBelongsToSource({ row: thread, entry }),
    )
    .flatMap((thread): ReadonlyArray<UnreadThread> => {
      const commentThread = commentThreads.get(thread.threadId) ?? null;
      const others = commentThread === null ? null : othersOf({ commentThread, viewerLogins });
      if (others !== null && others.length === 0) {
        return [];
      }
      const latestOtherMs = others === null ? null : latestMsOf({ comments: others });
      const readAt = reads[thread.threadId];
      if (readAt === undefined || (latestOtherMs !== null && latestOtherMs > readAt)) {
        return [{ threadId: thread.threadId, latestOtherMs }];
      }
      return [];
    });
};
