import { useState } from 'react';
import { CheckCheck, ExternalLink } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import type { CommentThread } from '../../comment-threads';
import { isBot } from '../../comment-threads';
import { TranscriptDisclosure } from '../../../chat/components/TranscriptDisclosure';
import { TranscriptRowHeader } from '../../../chat/components/TranscriptRowHeader';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { ThreadBody } from './ThreadBody';
import { ThreadPathChip } from './ThreadPathChip';
import { ThreadReplies } from './ThreadReplies';
import { threadPreview } from './threadPreview';

type Props = {
  readonly thread: CommentThread;
  readonly onOpenUrl: (url: string) => void;
};

export const ResolvedThread = ({ thread, onOpenUrl }: Props) => {
  const [open, setOpen] = useState(false);
  const { head, replies } = thread;

  return (
    <TranscriptDisclosure
      tone="success"
      open={open}
      header={
        <TranscriptRowHeader
          tone="success"
          grouped
          open={open}
          onToggle={() => setOpen((v) => !v)}
          icon={<CheckCheck size={12} aria-hidden />}
          eyebrow="resolved"
          badge={
            <span className="flex shrink-0 items-center gap-1.5">
              <span className="text-2xs font-medium text-foreground/70">{head.author}</span>
              {head.outdated === true ? (
                <Chip
                  tone="neutral"
                  size="xs"
                  label="Outdated"
                  title="This comment is anchored to code that later commits changed"
                />
              ) : null}
            </span>
          }
          preview={threadPreview({ body: head.body })}
          meta={formatRelativeAge({ fromIso: head.createdAt })}
          aria-label={`Resolved thread by ${head.author}`}
        />
      }
    >
      {head.path != null && head.path !== '' ? (
        <ThreadPathChip
          path={head.path}
          line={head.line ?? null}
          onOpen={() => onOpenUrl(head.url)}
        />
      ) : null}
      <div className="[overflow-wrap:anywhere]">
        <ThreadBody body={head.body} clamped={isBot(head.author)} />
      </div>
      <ThreadReplies replies={replies} />
      <button
        type="button"
        onClick={() => onOpenUrl(head.url)}
        className="inline-flex w-fit items-center gap-1 text-2xs text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        open on GitHub
        <ExternalLink size={11} aria-hidden />
      </button>
    </TranscriptDisclosure>
  );
};
