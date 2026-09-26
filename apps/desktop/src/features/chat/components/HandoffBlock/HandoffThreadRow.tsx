import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { GhostActionButton } from '@goodboy/ui';
import type { HandoffRef, SessionId } from '@goodboy/types';
import { openUrl } from '../../../../shared/lib/editor';
import { ConversationThread } from '../../../github/components/PullRequest/ConversationThread';
import { openReviewThread } from '../../../review/openReviewThread';
import { TranscriptChevron } from '../TranscriptChevron';
import { useDockedReviewThread } from './useDockedReviewThread';

type Props = {
  readonly entry: Extract<HandoffRef, { kind: 'thread' }>;
  readonly sessionId: SessionId | null;
};

export const HandoffThreadRow = ({ entry, sessionId }: Props) => {
  const [open, setOpen] = useState(false);
  const threadId = entry.threadId;
  const link = entry.link ?? '';
  const docked = useDockedReviewThread({ sessionId, threadId });
  const reviewSessionId = threadId === null || threadId === '' ? null : sessionId;

  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-md bg-subtle p-3"
      data-testid="handoff-thread"
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-code text-foreground">
          {entry.location ?? 'PR conversation'}
        </span>
        {reviewSessionId !== null && threadId !== null ? (
          <GhostActionButton
            icon={ArrowUpRight}
            label="Open in Review"
            onClick={() =>
              void openReviewThread({ sessionId: reviewSessionId, threadId, prUrl: link })
            }
          />
        ) : null}
        {docked !== null ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-secondary font-medium text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
          >
            {open ? 'Hide thread' : 'View thread'}
            <TranscriptChevron open={open} />
          </button>
        ) : link !== '' ? (
          <GhostActionButton
            icon={ArrowUpRight}
            label="Open on GitHub"
            onClick={() => void openUrl(link)}
          />
        ) : null}
      </div>
      {entry.author === null ? null : (
        <span className="text-secondary text-muted-foreground">{entry.author}</span>
      )}
      {open && docked !== null ? (
        <ConversationThread thread={docked} onOpenUrl={(url) => void openUrl(url)} />
      ) : entry.label === '' ? null : (
        <span className="text-label text-foreground">{entry.label}</span>
      )}
    </div>
  );
};
