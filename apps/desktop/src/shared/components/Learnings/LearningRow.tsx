import { ArrowUpRight, Eye, Undo2, X } from 'lucide-react';
import { Button, Chip, ICON_SIZE, cn } from '@goodboy/ui';
import type { SessionContextItem } from '@goodboy/types';
import { learningOriginLine, learningSourceLine } from './learningCopy';

type Props = {
  readonly item: SessionContextItem;
  readonly placement: 'drawer' | 'workspace';
  readonly isOpen: boolean;
  readonly now: number;
  readonly onToggle: () => void;
  readonly onDismiss: () => void;
  readonly onUndo: () => void;
  readonly onOpenSession?: () => void;
};

const META = 'text-meta text-faint-foreground';

export const LearningRow = ({
  item,
  placement,
  isOpen,
  now,
  onToggle,
  onDismiss,
  onUndo,
  onOpenSession,
}: Props) => {
  if (item.status === 'dismissed') {
    return (
      <div className="flex flex-col gap-1 rounded-md px-2 py-2">
        <span className="truncate text-label text-faint-foreground line-through">{item.title}</span>
        <div className="flex items-center gap-2">
          <Chip tone="neutral" kind="state" label="Dismissed" />
          <span className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Undo dismiss: ${item.title}`}
            onClick={onUndo}
          >
            <Undo2 size={ICON_SIZE.row} aria-hidden />
            Undo
          </Button>
        </div>
      </div>
    );
  }
  const isWorkspace = placement === 'workspace';
  const meta = isWorkspace ? learningOriginLine({ item, now }) : learningSourceLine({ item, now });
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md px-2 py-2 motion-safe:transition-colors',
        isOpen ? 'bg-selected' : 'hover:bg-hover',
      )}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={cn(
          'flex w-full min-w-0 text-left',
          isWorkspace && !isOpen ? 'items-baseline gap-3' : 'flex-col items-start gap-1',
        )}
      >
        {!isWorkspace && item.topic !== null ? (
          <Chip tone="neutral" kind="state" label={item.topic} />
        ) : null}
        <span
          className={cn(
            'min-w-0 text-label text-foreground',
            isWorkspace && 'flex-1',
            !isOpen && (isWorkspace ? 'truncate' : 'line-clamp-2'),
          )}
        >
          {item.title}
        </span>
        <span className={cn(META, 'shrink-0')}>{meta}</span>
      </button>
      {isOpen ? (
        <>
          <p className="text-meta text-muted-foreground">{item.text}</p>
          <div className="-mx-2 flex flex-wrap items-center gap-1">
            <span className={cn(META, 'inline-flex items-center gap-1 px-2')}>
              {isWorkspace ? null : <Eye size={ICON_SIZE.mark} aria-hidden />}
              {isWorkspace ? learningSourceLine({ item, now }) : 'Visible to you only'}
            </span>
            <span className="flex-1" />
            {isWorkspace && !item.isSessionDeleted && onOpenSession !== undefined ? (
              <Button variant="ghost" size="sm" onClick={onOpenSession}>
                Open session
                <ArrowUpRight size={ICON_SIZE.mark} aria-hidden />
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <X size={ICON_SIZE.row} aria-hidden />
              Dismiss
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
};
