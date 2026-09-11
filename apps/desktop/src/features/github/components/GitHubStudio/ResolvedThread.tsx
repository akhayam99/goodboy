import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { Chip } from '@goodboy/ui';
import type { CommentThread } from '../../comment-threads';
import { TranscriptDisclosure } from '../../../chat/components/TranscriptDisclosure';
import { TranscriptRowHeader } from '../../../chat/components/TranscriptRowHeader';
import { ReviewThreadContent } from '../../../review/components/ReviewThreadContent';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';
import { threadPreview } from './threadPreview';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly thread: CommentThread;
  readonly onOpenUrl: (url: string) => void;
};

export const ResolvedThread = ({ thread, onOpenUrl }: Props) => {
  const [open, setOpen] = useState(false);
  const { head } = thread;

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
          icon={<CheckCheck size={ICON_SIZE.row} aria-hidden />}
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
      <ReviewThreadContent thread={thread} onOpenUrl={onOpenUrl} />
    </TranscriptDisclosure>
  );
};
