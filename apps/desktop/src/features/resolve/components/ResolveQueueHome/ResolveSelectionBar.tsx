import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { CommentThread } from '../../../github/comment-threads';
import {
  RESOLVE_QUEUE_ACTION_LABEL,
  RESOLVE_RUN_IN_PROGRESS,
  resolveCountLabel,
  resolveSelectionLabel,
} from '../../resolveQueueCopy';
import { ResolveWithPopover } from '../ResolveWithPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly threads: ReadonlyArray<CommentThread>;
  readonly isRunLive: boolean;
  readonly onClear: () => void;
};

export const ResolveSelectionBar = ({ sessionId, threads, isRunLive, onClear }: Props) => (
  <div
    role="toolbar"
    aria-label={resolveSelectionLabel({ count: threads.length })}
    className="flex min-w-0 items-center gap-2 rounded-md bg-subtle px-3 py-1.5"
  >
    <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
      {resolveSelectionLabel({ count: threads.length })}
    </span>
    <Button size="sm" variant="ghost" onClick={onClear}>
      {RESOLVE_QUEUE_ACTION_LABEL.clearSelection}
    </Button>
    <ResolveWithPopover
      sessionId={sessionId}
      threads={threads}
      label={resolveCountLabel({ count: threads.length })}
      isDisabled={isRunLive}
      disabledReason={RESOLVE_RUN_IN_PROGRESS}
      onStarted={onClear}
    />
  </div>
);
