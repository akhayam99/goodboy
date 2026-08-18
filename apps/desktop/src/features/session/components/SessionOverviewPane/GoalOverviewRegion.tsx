import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Button, ClampedProse, CopyButton, Eyebrow, Textarea } from '@goodboy/ui';
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
  const hasValue = value.length > 0;

  useEffect(() => {
    if (isEditing === false) {
      setDraft(value);
    }
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

  return (
    <section aria-label="Goal" className="flex flex-col gap-2">
      <Eyebrow label="Goal" muted className="px-0.5 font-medium" />
      <div className="flex flex-col gap-4 rounded-lg border border-border-soft bg-subtle px-4 py-3">
        <div className="flex items-start justify-end gap-2">
          {hasValue ? (
            <Button size="sm" variant="ghost" onClick={startEditing} disabled={isSummarizing}>
              Edit
            </Button>
          ) : null}
          {hasValue ? (
            <CopyButton
              presentation="icon"
              value={value}
              label="copy goal"
              size={15}
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            />
          ) : null}
          {historyCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenHistory}
              aria-label={`View ${historyCount} previous ${historyCount === 1 ? 'version' : 'versions'} of Goal`}
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            >
              <History size={13} aria-hidden />
              {historyCount} {historyCount === 1 ? 'version' : 'versions'}
            </Button>
          ) : null}
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2" aria-label="Loading goal">
            <div className="h-4 w-full rounded bg-muted/50" />
            <div className="h-4 w-3/4 rounded bg-muted/50" />
          </div>
        ) : isEditing ? (
          <Textarea
            autoFocus
            aria-label="Goal"
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
            className="font-mono text-sm"
            autoGrow
            maxRows={24}
          />
        ) : hasValue === false ? (
          <div className="flex items-center gap-4 rounded-lg bg-subtle p-3">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">No goal yet</p>
            <Button size="sm" variant="ghost" onClick={startEditing} disabled={isSummarizing}>
              Add
            </Button>
          </div>
        ) : (
          <div className="min-w-0">
            <ClampedProse text={value} lines={2} className="text-base leading-relaxed" />
          </div>
        )}
        <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
      </div>
    </section>
  );
};
