import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { Button, CopyButton, Markdown, Textarea, cn } from '@goodboy/ui';
import type { ContextSlotHistoryEntry, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { GoalAttachmentsStrip } from '../../../../../context/components/ContextPanel/strips/GoalAttachmentsStrip';

export type ContextRegionKey = 'goal' | 'decisions' | 'last_output_summary';

type Props = {
  readonly sessionId: SessionId;
  readonly slotKey: ContextRegionKey;
  readonly title: string;
  readonly description: string;
  readonly emptyLabel: string;
  readonly value: string;
  readonly copyValue: string;
  readonly history: ReadonlyArray<ContextSlotHistoryEntry>;
  readonly isLoading: boolean;
  readonly isSummarizing: boolean;
  readonly onOpenHistory: () => void;
};

export const ContextRegion = ({
  sessionId,
  slotKey,
  title,
  description,
  emptyLabel,
  value,
  copyValue,
  history,
  isLoading,
  isSummarizing,
  onOpenHistory,
}: Props) => {
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const hasValue = value.length > 0;
  const rendersMarkdown = slotKey !== 'goal';

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
    void upsertSessionSlot(sessionId, slotKey, draft);
  };

  const startEditing = () => {
    if (isSummarizing) {
      return;
    }
    setIsEditing(true);
  };

  return (
    <section
      id={`context-${slotKey}`}
      aria-labelledby={`context-${slotKey}-title`}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id={`context-${slotKey}-title`} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasValue ? (
            <CopyButton
              presentation="icon"
              value={copyValue}
              label={
                slotKey === 'last_output_summary'
                  ? 'copy shareable summary'
                  : `copy ${title.toLowerCase()}`
              }
              size={15}
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            />
          ) : null}
          {history.length > 0 ? (
            <button
              type="button"
              onClick={onOpenHistory}
              aria-label={`View history for ${title}`}
              className="rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <History size={15} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2" aria-label={`Loading ${title.toLowerCase()}`}>
          <div className="h-4 w-full rounded bg-muted/50" />
          <div className="h-4 w-3/4 rounded bg-muted/50" />
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
          className="font-mono text-sm"
          autoGrow
          maxRows={24}
        />
      ) : hasValue === false ? (
        <div className="flex items-center gap-4 rounded-lg bg-subtle p-3">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">{emptyLabel}</p>
          <Button size="sm" variant="ghost" onClick={startEditing} disabled={isSummarizing}>
            Add
          </Button>
        </div>
      ) : rendersMarkdown ? (
        <div
          role={isSummarizing ? undefined : 'button'}
          tabIndex={isSummarizing ? -1 : 0}
          onClick={startEditing}
          onKeyDown={(event) => {
            if (isSummarizing) {
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setIsEditing(true);
            }
          }}
          className={cn(
            'rounded-lg leading-relaxed transition-colors [overflow-wrap:anywhere] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/15 [&_pre]:whitespace-pre-wrap',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/[0.02]',
          )}
        >
          <Markdown text={value} />
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={isSummarizing}
          className={cn(
            'whitespace-pre-wrap break-words rounded-lg text-left text-base font-medium leading-relaxed text-foreground transition-colors',
            isSummarizing ? 'cursor-default' : 'cursor-text hover:bg-foreground/[0.02]',
          )}
        >
          {value}
        </button>
      )}
      {slotKey === 'goal' ? (
        <GoalAttachmentsStrip owner={{ type: 'session', id: sessionId }} />
      ) : null}
    </section>
  );
};
