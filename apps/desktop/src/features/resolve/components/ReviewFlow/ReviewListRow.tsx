import { WorkNode, cn, inlineMarkdownText } from '@goodboy/ui';
import { REVIEW_COMMENT_NODE } from '../../reviewCommentState';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { firstSentence } from './firstSentence';
import { STATE_WORD_TONE } from './stateTone';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly entry: ReviewEntry;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

const fileOf = ({ path }: { readonly path: string | null }): string | null =>
  path === null ? null : (path.split('/').at(-1) ?? path);

export const ReviewListRow = ({ entry, isSelected, onSelect }: Props) => {
  const note = entry.row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  const file = fileOf({ path: note?.path ?? null });
  return (
    <button
      type="button"
      data-thread-id={entry.threadId}
      aria-current={isSelected ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        'group/review-row flex w-full min-w-0 items-start gap-2.5 rounded-md px-2.5 py-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        'motion-safe:transition-colors',
        isSelected ? 'bg-selected' : 'hover:bg-hover',
      )}
    >
      <span className="flex h-5 shrink-0 items-center">
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
          <span className={cn('ml-auto shrink-0', STATE_WORD_TONE[entry.state])}>{entry.word}</span>
        </span>
        <span className="min-w-0 truncate text-body text-foreground" title={body ?? undefined}>
          {title}
        </span>
      </span>
    </button>
  );
};
