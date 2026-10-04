import { ExternalLink, MessageSquare } from 'lucide-react';
import { Avatar, Chip, Tooltip } from '@goodboy/ui';
import type { CommentThread } from '../../../integrations/github/comment-threads';
import { isBot } from '../../../integrations/github/comment-threads';
import { ThreadBody } from '../../../integrations/github/components/PullRequest/ThreadBody';
import { ThreadPathChip } from '../../../integrations/github/components/PullRequest/ThreadPathChip';
import { ThreadReplies } from '../../../integrations/github/components/PullRequest/ThreadReplies';
import { RelativeTime } from '../../../../shared/components/RelativeTime';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly thread: CommentThread;
  readonly onOpenUrl: (url: string) => void;
};

const NOTE_LABEL = 'Note';

const OUTDATED_HINT = 'This comment is anchored to code that later commits changed';

export const ReviewThreadContent = ({ thread, onOpenUrl }: Props) => {
  const { head, replies } = thread;
  const isNote = head.url === '';
  const isReview = head.source === 'review' && !isNote;
  const path = head.path ?? '';

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 text-label text-muted-foreground">
        <Avatar url={head.authorAvatarUrl} alt={head.author} />
        <span className="min-w-0 truncate font-medium text-foreground">{head.author}</span>
        {isBot(head.author) && <Chip tone="info" size="xs" label="Bot" />}
        <span className="shrink-0 opacity-50">·</span>
        <span className="shrink-0">
          <RelativeTime iso={head.createdAt} />
        </span>
        {isReview && head.resolved === false && <Chip tone="warning" size="xs" label="Open" />}
        {isReview && head.resolved === true && <Chip tone="success" size="xs" label="Resolved" />}
        {isNote && (
          <Chip
            tone="neutral"
            size="xs"
            icon={<MessageSquare size={ICON_SIZE.row} aria-hidden />}
            label={NOTE_LABEL}
          />
        )}
        {head.outdated === true && (
          <Chip tone="neutral" size="xs" label="Outdated" title={OUTDATED_HINT} />
        )}
        {!isNote && (
          <span className="ml-auto inline-flex shrink-0 items-center">
            <Tooltip content="Open in browser">
              <button
                type="button"
                onClick={() => onOpenUrl(head.url)}
                aria-label="Open in browser"
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-hover hover:text-foreground"
              >
                <ExternalLink size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
          </span>
        )}
      </div>
      {path !== '' && !isNote && (
        <ThreadPathChip path={path} line={head.line ?? null} onOpen={() => onOpenUrl(head.url)} />
      )}
      <div className="[overflow-wrap:anywhere]">
        <ThreadBody body={head.body} clamped={isBot(head.author)} />
      </div>
      <ThreadReplies replies={replies} />
    </div>
  );
};
