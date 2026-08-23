import { useEffect, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { History } from 'lucide-react';
import { CopyButton, Eyebrow, Textarea, Tooltip, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';

type Props = {
  readonly sessionId: SessionId;
  readonly value: string;
  readonly historyCount: number;
  readonly isLoading: boolean;
  readonly isSummarizing: boolean;
  readonly onOpenHistory: () => void;
};

type ClickParams = {
  readonly event: MouseEvent<HTMLElement>;
};

const isTextGesture = ({ event }: ClickParams): boolean => {
  if (event.target instanceof Element && event.target.closest('a') != null) {
    return true;
  }
  const selection = window.getSelection();
  return selection != null && selection.isCollapsed === false && selection.toString() !== '';
};

export const GoalOverviewRegion = ({
  sessionId,
  value,
  historyCount,
  isLoading,
  isSummarizing,
  onOpenHistory,
}: Props) => {
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    setDraft(value);
  }, [isEditing, value]);

  const commit = () => {
    setIsEditing(false);
    if (draft === value) {
      return;
    }
    void upsertSessionSlot(sessionId, 'goal', draft);
  };

  const startEditing = () => {
    if (isSummarizing) {
      return;
    }
    setIsEditing(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    startEditing();
  };

  const hasValue = value !== '';

  return (
    <section aria-label="Goal" className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 px-0.5">
        <Eyebrow label="Goal" className="shrink-0" />
        {isLoading ? (
          <span className="h-4 min-w-0 flex-1 rounded bg-muted/50" aria-label="Loading goal" />
        ) : isEditing ? (
          <Textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setDraft(value);
                setIsEditing(false);
                return;
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                commit();
              }
            }}
            aria-label="Goal"
            className="min-w-0 flex-1 text-sm"
            autoGrow
            maxRows={12}
          />
        ) : (
          <Tooltip content={hasValue ? value : 'Add a goal'}>
            <span
              role="button"
              tabIndex={isSummarizing ? -1 : 0}
              onClick={(event) => {
                if (isTextGesture({ event })) {
                  return;
                }
                startEditing();
              }}
              onKeyDown={onKeyDown}
              aria-label={hasValue ? 'Edit goal' : 'Add a goal'}
              className={cn(
                'min-w-0 flex-1 truncate rounded-md text-sm motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]',
                hasValue ? 'text-foreground' : 'text-muted-foreground',
                isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/[0.03]',
              )}
            >
              {hasValue ? value : 'No goal yet'}
            </span>
          </Tooltip>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {hasValue ? (
            <CopyButton
              presentation="icon"
              value={value}
              label="copy goal"
              size={13}
              className="rounded-md p-1 text-muted-foreground/60 motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground"
            />
          ) : null}
          {historyCount > 0 ? (
            <Tooltip
              content={`${historyCount} previous ${historyCount === 1 ? 'version' : 'versions'}`}
            >
              <button
                type="button"
                onClick={onOpenHistory}
                aria-label={`View ${historyCount} previous ${historyCount === 1 ? 'version' : 'versions'} of Goal`}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/60 motion-safe:transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <History size={13} aria-hidden />
              </button>
            </Tooltip>
          ) : null}
        </span>
      </div>
      <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
    </section>
  );
};
