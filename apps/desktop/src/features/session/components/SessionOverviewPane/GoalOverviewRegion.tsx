import { useEffect, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { History, Plus } from 'lucide-react';
import {
  Button,
  Chip,
  ClampedProse,
  SectionHeader,
  Skeleton,
  Textarea,
  Tooltip,
  cn,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { GoalAttachmentsStrip } from '../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly sessionTitle: string;
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
  if (event.target instanceof Element && event.target.closest('a, button') != null) {
    return true;
  }
  const selection = window.getSelection();
  return selection != null && selection.isCollapsed === false && selection.toString() !== '';
};

export const GoalOverviewRegion = ({
  sessionId,
  sessionTitle,
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
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    startEditing();
  };

  const hasValue = value !== '';
  const isSameAsTitle = hasValue && value.trim() === sessionTitle.trim();
  const hasOwnText = hasValue && !isSameAsTitle;
  const isQuiet = !isLoading && !isEditing && !hasOwnText;
  const historyAction =
    historyCount === 0 ? null : (
      <Tooltip content={`${historyCount} previous ${historyCount === 1 ? 'version' : 'versions'}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenHistory}
          aria-label={`View ${historyCount} previous ${historyCount === 1 ? 'version' : 'versions'} of Goal`}
        >
          <History size={ICON_SIZE.row} aria-hidden />
          History
        </Button>
      </Tooltip>
    );

  if (isQuiet) {
    return (
      <section aria-label="Goal" className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip content={isSameAsTitle ? 'The title is the whole goal so far' : 'No goal yet'}>
            <Chip
              as="button"
              tone="neutral"
              shape="badge"
              size="control"
              bordered={false}
              disabled={isSummarizing}
              onClick={startEditing}
              icon={<Plus size={11} aria-hidden />}
              label={isSameAsTitle ? 'Detail the goal' : 'Add a goal'}
              className="border border-dashed border-border bg-transparent"
            />
          </Tooltip>
          {historyAction}
        </div>
        <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
      </section>
    );
  }

  return (
    <section aria-label="Goal" className="flex min-w-0 flex-col gap-2">
      <SectionHeader label="Goal" className="px-0.5" action={historyAction} />
      {isLoading ? (
        <div role="status" aria-label="Loading goal">
          <Skeleton className="h-4 w-2/3" />
        </div>
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
          className="min-w-0 text-sm"
          autoGrow
          maxRows={12}
        />
      ) : (
        <div
          role="button"
          tabIndex={isSummarizing ? -1 : 0}
          onClick={(event) => {
            if (isTextGesture({ event })) {
              return;
            }
            startEditing();
          }}
          onKeyDown={onKeyDown}
          aria-label="Edit goal"
          className={cn(
            'min-w-0 max-w-full rounded-md text-foreground motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-hover',
          )}
        >
          <ClampedProse text={value} lines={4} className="text-sm text-foreground" />
        </div>
      )}
      <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
    </section>
  );
};
