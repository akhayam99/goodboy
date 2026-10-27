import type { CommentThread } from '../../../integrations/github/comment-threads';
import { isBot } from '../../../integrations/github/comment-threads';
import { ThreadBody } from '../../../../shared/components/ThreadBody';
import { ThreadReplies } from '../../../../shared/components/ThreadReplies';
import { threadReplyItemsOf } from '../../../integrations/github/threadReplyItemsOf';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';

type Props = {
  readonly commentThread: CommentThread | null;
};

export const ReviewerCommentBlock = ({ commentThread }: Props) =>
  commentThread === null ? (
    <p className="text-body text-muted-foreground">{RESOLVE_COMMENT_UNAVAILABLE}</p>
  ) : (
    <div className="flex min-w-0 max-w-[var(--measure)] flex-col gap-2 [overflow-wrap:anywhere]">
      <ThreadBody body={commentThread.head.body} isClamped={isBot(commentThread.head.author)} />
      <ThreadReplies replies={threadReplyItemsOf({ replies: commentThread.replies })} />
    </div>
  );
