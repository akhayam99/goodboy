import type { CommentThread } from '../../../integrations/github/comment-threads';
import { isBot } from '../../../integrations/github/comment-threads';
import { ThreadBody } from '../../../integrations/github/components/PullRequest/ThreadBody';
import { ThreadReplies } from '../../../integrations/github/components/PullRequest/ThreadReplies';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';

type Props = {
  readonly commentThread: CommentThread | null;
};

export const ReviewerCommentBlock = ({ commentThread }: Props) =>
  commentThread === null ? (
    <p className="text-body text-muted-foreground">{RESOLVE_COMMENT_UNAVAILABLE}</p>
  ) : (
    <div className="flex min-w-0 max-w-[72ch] flex-col gap-2 [overflow-wrap:anywhere]">
      <ThreadBody body={commentThread.head.body} clamped={isBot(commentThread.head.author)} />
      <ThreadReplies replies={commentThread.replies} />
    </div>
  );
