import { Checkbox, cn, inlineMarkdownText } from '@goodboy/ui';
import { REVIEW_LAUNCH_LABEL } from '../../../reviewLaunchCopy';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../../resolveQueueCopy';
import { firstSentence } from '../firstSentence';
import type { ReviewEntry } from '../useReviewEntries';

type Props = {
  readonly entry: ReviewEntry;
  readonly isIncluded: boolean;
  readonly onToggle: () => void;
};

const fileOf = ({ path }: { readonly path: string | null }): string | null =>
  path === null ? null : (path.split('/').at(-1) ?? path);

export const LaunchPanelRow = ({ entry, isIncluded, onToggle }: Props) => {
  const note = entry.row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  const file = fileOf({ path: note?.path ?? null });
  return (
    <Checkbox
      checked={isIncluded}
      onChange={onToggle}
      ariaLabel={`${REVIEW_LAUNCH_LABEL.includeRow} ${note?.author ?? ''}`.trim()}
      className="w-full gap-3rounded-md px-2 py-1 hover:bg-hover motion-safe:transition-colors"
      label={
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-2 text-meta">
            {note !== null && <span className="shrink-0 text-muted-foreground">{note.author}</span>}
            {file !== null && (
              <span className="min-w-0 truncate font-mono text-faint-foreground">
                {file}
                {note?.line == null ? '' : `:${note.line}`}
              </span>
            )}
            <span className="ml-auto shrink-0 text-faint-foreground">{entry.word}</span>
          </span>
          <span
            className={cn(
              'min-w-0 truncate text-body',
              isIncluded ? 'text-foreground' : 'text-faint-foreground line-through',
            )}
            title={body ?? undefined}
          >
            {title}
          </span>
        </span>
      }
    />
  );
};
