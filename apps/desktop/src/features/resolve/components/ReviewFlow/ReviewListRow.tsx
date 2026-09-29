import { Check } from 'lucide-react';
import { WorkNode, cn, inlineMarkdownText } from '@goodboy/ui';
import { REVIEW_LAUNCH_LABEL } from '../../reviewLaunchCopy';
import { REVIEW_COMMENT_NODE } from '../../reviewCommentState';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { firstSentence } from './firstSentence';
import { STATE_WORD_TONE } from './stateTone';
import type { ReviewEntry } from './useReviewEntries';

export type RowSelection = {
  readonly isChecked: boolean;
  readonly isSelecting: boolean;
  readonly onToggle: () => void;
};

type Props = {
  readonly entry: ReviewEntry;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
  readonly onFix: (() => void) | null;
  readonly selection: RowSelection | null;
};

const fileOf = ({ path }: { readonly path: string | null }): string | null =>
  path === null ? null : (path.split('/').at(-1) ?? path);

export const ReviewListRow = ({ entry, isSelected, onSelect, onFix, selection }: Props) => {
  const note = entry.row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  const file = fileOf({ path: note?.path ?? null });
  return (
    <div className="group/review-row relative min-w-0">
      <button
        type="button"
        data-thread-id={entry.threadId}
        aria-current={isSelected ? 'true' : undefined}
        onClick={onSelect}
        className={cn(
          'flex w-full min-w-0 items-start gap-2.5 rounded-md px-2.5 py-2 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          'motion-safe:transition-colors',
          isSelected ? 'bg-selected' : 'hover:bg-hover',
        )}
      >
        <span
          className={cn(
            'flex h-5 shrink-0 items-center motion-safe:transition-opacity',
            selection !== null &&
              (selection.isChecked || selection.isSelecting
                ? 'opacity-0'
                : 'group-focus-within/review-row:opacity-0 group-hover/review-row:opacity-0'),
          )}
        >
          <WorkNode
            state={REVIEW_COMMENT_NODE[entry.state]}
            label={entry.word}
            mark={{ kind: 'dot' }}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2 text-secondary">
            {note !== null && <span className="shrink-0 text-muted-foreground">{note.author}</span>}
            {file !== null && (
              <span className="min-w-0 truncate font-mono text-faint-foreground">
                {file}
                {note?.line == null ? '' : `:${note.line}`}
              </span>
            )}
            <span
              className={cn(
                'ml-auto shrink-0 motion-safe:transition-opacity',
                STATE_WORD_TONE[entry.state],
                onFix !== null &&
                  'group-focus-within/review-row:opacity-0 group-hover/review-row:opacity-0',
              )}
            >
              {entry.word}
            </span>
          </span>
          <span className="min-w-0 truncate text-body text-foreground" title={body ?? undefined}>
            {title}
          </span>
        </span>
      </button>
      {selection !== null && (
        <button
          type="button"
          role="checkbox"
          aria-checked={selection.isChecked}
          aria-label={`${REVIEW_LAUNCH_LABEL.selectRow} ${note?.author ?? ''}`.trim()}
          data-select-row={entry.threadId}
          onClick={selection.onToggle}
          className={cn(
            'absolute left-2.5 top-2 flex size-5 items-center justify-center rounded-md',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            selection.isChecked || selection.isSelecting
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/review-row:opacity-100 group-hover/review-row:opacity-100',
          )}
        >
          <span
            className={cn(
              'flex size-4 items-center justify-center rounded-md border motion-safe:transition-colors',
              selection.isChecked
                ? 'border-primary bg-primary text-on-tone'
                : 'border-border bg-background hover:border-foreground',
            )}
          >
            {selection.isChecked && <Check size={11} strokeWidth={3} aria-hidden />}
          </span>
        </button>
      )}
      {onFix !== null && (
        <button
          type="button"
          data-fix-row={entry.threadId}
          onClick={onFix}
          className={cn(
            'absolute right-2 top-1.5 rounded-md bg-elevated px-2.5 py-0.5 text-label text-foreground ring-1 ring-border-soft',
            'opacity-0 group-focus-within/review-row:opacity-100 group-hover/review-row:opacity-100',
            'hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-opacity',
          )}
        >
          {REVIEW_LAUNCH_LABEL.fix}
        </button>
      )}
    </div>
  );
};
