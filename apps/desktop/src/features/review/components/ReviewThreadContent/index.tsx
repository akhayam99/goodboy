import { ExternalLink } from 'lucide-react';
import { Avatar, Chip, Tooltip } from '@goodboy/ui';
import type { CommentThread } from '../../../github/comment-threads';
import { isBot } from '../../../github/comment-threads';
import { ThreadBody } from '../../../github/components/GitHubStudio/ThreadBody';
import { ThreadPathChip } from '../../../github/components/GitHubStudio/ThreadPathChip';
import { ThreadReplies } from '../../../github/components/GitHubStudio/ThreadReplies';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly thread: CommentThread;
  readonly onOpenUrl: (url: string) => void;
};

const OUTDATED_HINT = 'This comment is anchored to code that later commits changed';

export const ReviewThreadContent = ({ thread, onOpenUrl }: Props) => {
  const { head, replies } = thread;
  const isReview = head.source === 'review';
  const path = head.path ?? '';

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Avatar url={head.authorAvatarUrl} alt={head.author} />
        <span className="min-w-0 truncate font-medium text-foreground">{head.author}</span>
        {isBot(head.author) && <Chip tone="info" size="xs" uppercase label="bot" />}
        <span className="shrink-0 opacity-50">·</span>
        <span className="shrink-0">{formatRelativeAge({ fromIso: head.createdAt })}</span>
        {isReview && head.resolved === false && <Chip tone="warning" size="xs" label="Open" />}
        {isReview && head.resolved === true && <Chip tone="success" size="xs" label="Resolved" />}
        {head.outdated === true && (
          <Chip tone="neutral" size="xs" label="Outdated" title={OUTDATED_HINT} />
        )}
        <span className="ml-auto inline-flex shrink-0 items-center">
          <Tooltip content="Open in browser">
            <button
              type="button"
              onClick={() => onOpenUrl(head.url)}
              aria-label="Open in browser"
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ExternalLink size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
        </span>
      </div>
      {path !== '' && (
        <ThreadPathChip path={path} line={head.line ?? null} onOpen={() => onOpenUrl(head.url)} />
      )}
      <div className="[overflow-wrap:anywhere]">
        <ThreadBody body={head.body} clamped={isBot(head.author)} />
      </div>
      <ThreadReplies replies={replies} />
    </div>
  );
};
