import type { CommentThread } from '../../../../github/comment-threads';
import { ReviewThreadContent } from '../../../../review/components/ReviewThreadContent';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../../resolveQueueCopy';

type Props = {
  readonly commentThread: CommentThread | null;
  readonly onOpenUrl: (url: string) => void;
};

export const ReviewerCommentBlock = ({ commentThread, onOpenUrl }: Props) => (
  <div className="flex min-w-0 max-w-[65ch] flex-col gap-2">
    {commentThread === null ? (
      <p className="text-sm text-muted-foreground">{RESOLVE_COMMENT_UNAVAILABLE}</p>
    ) : (
      <ReviewThreadContent thread={commentThread} onOpenUrl={onOpenUrl} />
    )}
  </div>
);
