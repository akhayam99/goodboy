import type { ResolveSourceSnapshot } from '@goodboy/types';
import type { CommentThread } from '../integrations/github/comment-threads';

import type { ResolveQueueRow } from './buildResolveQueueRows';

const SNAPSHOT_AUTHOR_UNKNOWN = 'Reviewer';

export const withSnapshotComment = ({
  row,
  snapshot,
}: {
  readonly row: ResolveQueueRow;
  readonly snapshot: ResolveSourceSnapshot | undefined;
}): ResolveQueueRow => {
  if (row.commentThread !== null) {
    return row;
  }
  const commentThread = snapshotCommentThread({ threadId: row.thread.threadId, snapshot });
  if (commentThread === null) {
    return row;
  }
  return {
    ...row,
    commentThread,
    reviewerNote: {
      source: 'github',
      body: commentThread.head.body,
      author: commentThread.head.author,
      createdAtMs: Date.parse(commentThread.head.createdAt),
      location: null,
      path: null,
      line: null,
    },
  };
};

export const snapshotCommentThread = ({
  threadId,
  snapshot,
}: {
  readonly threadId: string;
  readonly snapshot: ResolveSourceSnapshot | undefined;
}): CommentThread | null => {
  if (snapshot === undefined || snapshot.body.trim() === '') {
    return null;
  }
  return {
    head: {
      id: threadId,
      author: snapshot.author ?? SNAPSHOT_AUTHOR_UNKNOWN,
      authorAvatarUrl: null,
      body: snapshot.body,
      createdAt: new Date(snapshot.seenAt).toISOString(),
      url: '',
      source: 'review',
      resolved: false,
      threadId,
      canResolve: false,
    },
    replies: [],
  };
};
