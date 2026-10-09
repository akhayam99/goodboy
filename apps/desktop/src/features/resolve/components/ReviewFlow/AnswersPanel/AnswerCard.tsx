import { Button, Chip, cn, inlineMarkdownText } from '@goodboy/ui';
import { REVIEW_BULK_LABEL } from '../../../reviewBulkCopy';
import type { BulkQuestion } from '../bulkQuestions';

type Props = {
  readonly question: BulkQuestion;
  readonly chosen: string;
  readonly isDropped: boolean;
  readonly onChoose: (answer: string) => void;
  readonly onDrop: () => void;
  readonly onUndoDrop: () => void;
};

const fileOf = ({ path }: { readonly path: string | null }): string | null =>
  path === null ? null : (path.split('/').at(-1) ?? path);

export const AnswerCard = ({
  question,
  chosen,
  isDropped,
  onChoose,
  onDrop,
  onUndoDrop,
}: Props) => {
  const note = question.entry.row.reviewerNote;
  const file = fileOf({ path: note?.path ?? null });
  if (isDropped) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-meta text-muted-foreground">
        <span className="min-w-0 flex-1">{REVIEW_BULK_LABEL.dropped}</span>
        <Button size="sm" variant="ghost" onClick={onUndoDrop}>
          {REVIEW_BULK_LABEL.undoDrop}
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-3">
      <div className="flex min-w-0 items-center gap-2 text-meta">
        {note !== null && <span className="shrink-0 text-foreground">{note.author}</span>}
        {file !== null && (
          <span className="min-w-0 truncate font-mono text-faint-foreground">
            {file}
            {note?.line == null ? '' : `:${note.line}`}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDrop}
          className="ml-auto text-muted-foreground"
        >
          {REVIEW_BULK_LABEL.drop}
        </Button>
      </div>
      <p className="text-body text-foreground">{inlineMarkdownText({ text: question.text })}</p>
      <div
        role="radiogroup"
        aria-label={`${REVIEW_BULK_LABEL.answerFor} ${file ?? question.threadId}`}
        className="flex flex-col gap-0.5"
      >
        {question.options.map((option) => {
          const isChecked = option.answer === chosen;
          return (
            <button
              key={option.answer}
              type="button"
              role="radio"
              aria-checked={isChecked}
              onClick={() => onChoose(option.answer)}
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left motion-safe:transition-colors',
                'hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                isChecked && 'bg-selected',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                  isChecked ? 'ring-primary' : 'ring-border-strong',
                )}
              >
                {isChecked ? <span className="size-2 rounded-full bg-primary" /> : null}
              </span>
              <span className="min-w-0 flex-1 text-label text-foreground">{option.answer}</span>
              {option.isRecommended && (
                <Chip tone="primary" kind="state" label={REVIEW_BULK_LABEL.recommended} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
