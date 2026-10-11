import {
  ROW_INTERACTIVE,
  Checkbox,
  Chip,
  cn,
  inlineMarkdownText,
  TruncatedText,
} from '@goodboy/ui';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { firstSentence } from '../ReviewFlow/firstSentence';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { isNoteEntry } from './commentFilter';
import { FIX_COMMENTS_LABEL } from './fixCommentsCopy';

type Props = {
  readonly entry: ReviewEntry;
  readonly isIncluded: boolean;
  readonly onToggle: () => void;
};

const HOST_LABEL = {
  github: 'On GitHub',
  gitlab: 'On GitLab',
  bitbucket: 'On Bitbucket',
  note: FIX_COMMENTS_LABEL.noteChip,
} as const;

type FileParams = {
  readonly path: string | null;
};

const fileOf = ({ path }: FileParams): string | null =>
  path === null ? null : (path.split('/').at(-1) ?? path);

export const FixCommentRow = ({ entry, isIncluded, onToggle }: Props) => {
  const note = entry.row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  const file = fileOf({ path: note?.path ?? null });
  const chip = isNoteEntry({ entry }) ? HOST_LABEL.note : HOST_LABEL[note?.source ?? 'github'];
  return (
    <Checkbox
      checked={isIncluded}
      onChange={onToggle}
      ariaLabel={`Include the comment by ${note?.author ?? 'unknown'}`}
      className={cn('w-full gap-3 rounded-md px-2 py-1', ROW_INTERACTIVE)}
      label={
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2 text-meta">
            <Chip tone="neutral" label={chip} />
            {note !== null && <span className="shrink-0 text-muted-foreground">{note.author}</span>}
            {file !== null && (
              <span className="min-w-0 truncate font-mono text-faint-foreground">
                {file}
                {note?.line == null ? '' : `:${note.line}`}
              </span>
            )}
          </span>
          <TruncatedText
            tooltip={body ?? undefined}
            className={cn(
              'min-w-0 truncate text-body',
              isIncluded ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {title}
          </TruncatedText>
        </span>
      }
    />
  );
};
