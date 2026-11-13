import { SquareArrowOutUpRight, MessageSquare } from 'lucide-react';
import { Chip, ICON_SIZE, IconButton } from '@goodboy/ui';
import type { CommentThread } from '../../../integrations/github/comment-threads';
import { isBot } from '../../../integrations/github/comment-threads';
import { Person } from '../../../../shared/components/Person';
import { CommentBody } from '../../../../shared/components/CommentBody';
import { ThreadPathChip } from '../../../integrations/github/components/PullRequest/ThreadPathChip';
import { ThreadReplies } from '../../../../shared/components/ThreadReplies';
import { threadReplyItemsOf } from '../../../integrations/github/threadReplyItemsOf';
import { RelativeTime } from '../../../../shared/components/RelativeTime';

type Props = {
  readonly thread: CommentThread;
  readonly onOpenUrl: (url: string) => void;
};

const DRAFT_LABEL = 'Draft';

const OUTDATED_HINT = 'This comment is anchored to code that later commits changed';

export const ReviewThreadContent = ({ thread, onOpenUrl }: Props) => {
  const { head, replies } = thread;
  const isNote = head.url === '';
  const isReview = head.source === 'review' && !isNote;
  const path = head.path ?? '';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
        <Person
          login={head.author}
          avatarUrl={head.authorAvatarUrl}
          size="md"
          isBot={isBot(head.author)}
        />
        {isBot(head.author) && <Chip kind="state" tone="info" label="Bot" />}
        <span className="shrink-0 opacity-50">·</span>
        <span className="shrink-0">
          <RelativeTime iso={head.createdAt} />
        </span>
        {isReview && head.resolved === false && <Chip kind="state" tone="warning" label="Open" />}
        {isReview && head.resolved === true && (
          <Chip kind="state" tone="success" label="Resolved" />
        )}
        {isNote && (
          <Chip
            kind="state"
            tone="neutral"
            icon={<MessageSquare size={ICON_SIZE.row} aria-hidden />}
            label={DRAFT_LABEL}
          />
        )}
        {head.outdated === true && (
          <Chip kind="state" tone="neutral" label="Outdated" title={OUTDATED_HINT} />
        )}
        {!isNote && (
          <span className="ml-auto inline-flex shrink-0 items-center">
            <IconButton
              icon={SquareArrowOutUpRight}
              label="Open in browser"
              size="xs"
              onClick={() => onOpenUrl(head.url)}
            />
          </span>
        )}
      </div>
      {path !== '' && !isNote && (
        <ThreadPathChip path={path} line={head.line ?? null} onOpen={() => onOpenUrl(head.url)} />
      )}
      <div className="[overflow-wrap:anywhere]">
        <CommentBody body={head.body} isClamped={isBot(head.author)} />
      </div>
      <ThreadReplies replies={threadReplyItemsOf({ replies })} />
    </div>
  );
};
