import { ChevronRight, CircleCheck } from 'lucide-react';
import { FOCUS_RING, cn } from '@goodboy/ui';
import type { ConversationThread } from './types';

type Props = {
  readonly thread: ConversationThread;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

export const ResolvedThreadRow = ({ thread, isOpen, onToggle }: Props) => {
  const replies = thread.replies.length;
  const replyLabel = replies === 1 ? '1 reply' : `${replies} replies`;

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={onToggle}
      className={cn(
        'flex h-8 w-full min-w-0 items-center gap-2 rounded-md bg-subtle px-2 text-left text-secondary text-muted-foreground hover:bg-hover hover:text-foreground',
        FOCUS_RING,
      )}
    >
      <CircleCheck size={12} aria-hidden className="shrink-0 text-success" />
      <span className="min-w-0 flex-1 truncate">
        {`Resolved thread · ${thread.head.author.name}${replies > 0 ? ` · ${replyLabel}` : ''}`}
      </span>
      <ChevronRight
        size={12}
        aria-hidden
        className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-90')}
      />
    </button>
  );
};
