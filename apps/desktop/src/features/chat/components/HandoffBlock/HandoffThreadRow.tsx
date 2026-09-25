import { ArrowUpRight } from 'lucide-react';
import { GhostActionButton } from '@goodboy/ui';
import type { HandoffRef, SessionId } from '@goodboy/types';
import { openUrl } from '../../../../shared/lib/editor';
import { openReviewThread } from '../../../review/openReviewThread';

type Props = {
  readonly entry: Extract<HandoffRef, { kind: 'thread' }>;
  readonly sessionId: SessionId | null;
};

export const HandoffThreadRow = ({ entry, sessionId }: Props) => {
  const threadId = entry.threadId;
  const link = entry.link ?? '';
  const reviewSessionId = threadId === null || threadId === '' ? null : sessionId;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md bg-subtle p-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
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
        ) : link !== '' ? (
          <GhostActionButton
            icon={ArrowUpRight}
            label="Open on GitHub"
            onClick={() => void openUrl(link)}
          />
        ) : null}
      </div>
      {entry.author === null ? null : (
        <span className="text-2xs text-muted-foreground">{entry.author}</span>
      )}
      {entry.label === '' ? null : <span className="text-xs text-foreground">{entry.label}</span>}
    </div>
  );
};
