import type { PrComment, ResolvePublicationThread } from '@goodboy/types';
import { userReplyIn } from './userReplyIn';

export type ReplyOperationVerdict = 'posted' | 'not_posted' | 'ambiguous';

type Params = {
  readonly thread: ResolvePublicationThread;
  readonly comments: ReadonlyArray<PrComment>;
  readonly observedAt: number | null;
  readonly isObservationTrusted: boolean;
  readonly viewerLogins?: ReadonlySet<string>;
};

export const reconcileReplyOperation = ({
  thread,
  comments,
  observedAt,
  isObservationTrusted,
  viewerLogins = new Set<string>(),
}: Params): ReplyOperationVerdict => {
  if (thread.replyPostedAt !== null || thread.replyPhase === 'posted') {
    return 'posted';
  }
  if (thread.replyPhase !== 'uncertain') {
    return 'not_posted';
  }
  if (thread.replyBody === null) {
    return 'not_posted';
  }
  if (!isObservationTrusted || observedAt === null) {
    return 'ambiguous';
  }
  if (thread.replyAttemptedAt !== null && observedAt < thread.replyAttemptedAt) {
    return 'ambiguous';
  }
  const seen = comments.filter(
    (comment) => comment.threadId === thread.threadId && comment.body === thread.replyBody,
  ).length;
  if (seen > 1) {
    return 'ambiguous';
  }
  if (seen === 1) {
    return 'posted';
  }
  const handWritten = userReplyIn({
    comments,
    threadId: thread.threadId,
    viewerLogins,
    afterMs: thread.replyAttemptedAt ?? 0,
    ownReplyId: thread.replyId,
  });
  return handWritten === null ? 'not_posted' : 'posted';
};
