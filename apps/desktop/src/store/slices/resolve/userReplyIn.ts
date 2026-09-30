import type { PrComment } from '@goodboy/types';
import { groupThreads } from '../../../features/integrations/github/comment-threads';

type Params = {
  readonly comments: ReadonlyArray<PrComment>;
  readonly threadId: string;
  readonly viewerLogins: ReadonlySet<string>;
  readonly afterMs: number;
  readonly ownReplyId?: string | null;
};

export const userReplyIn = ({
  comments,
  threadId,
  viewerLogins,
  afterMs,
  ownReplyId = null,
}: Params): PrComment | null => {
  if (viewerLogins.size === 0) {
    return null;
  }
  const thread = groupThreads(comments.filter((comment) => comment.threadId === threadId))[0];
  if (thread === undefined) {
    return null;
  }
  const mine = thread.replies.filter(
    (reply) =>
      reply.id !== ownReplyId &&
      viewerLogins.has(reply.author.toLowerCase()) &&
      new Date(reply.createdAt).getTime() > afterMs,
  );
  return mine.at(-1) ?? null;
};
