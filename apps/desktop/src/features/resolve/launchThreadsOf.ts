import type { PrComment, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import type { CommentThread } from '../integrations/github/comment-threads';
import { launchRowsOf } from './reviewRows';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly comments?: ReadonlyArray<PrComment>;
};

const NOTHING_TO_DRAFT = 'These comments are no longer on the pull request';

export const launchThreadsOf = ({
  state,
  sessionId,
  threadIds,
  comments,
}: Params): ReadonlyArray<CommentThread> => {
  const rows = launchRowsOf({
    state,
    sessionId,
    ...(comments !== undefined && { freshComments: comments }),
  });
  const threads = threadIds.flatMap((threadId): ReadonlyArray<CommentThread> => {
    const commentThread = rows.find((row) => row.thread.threadId === threadId)?.commentThread;
    return commentThread == null ? [] : [commentThread];
  });
  if (threads.length === 0) {
    throw new Error(NOTHING_TO_DRAFT);
  }
  return threads;
};
