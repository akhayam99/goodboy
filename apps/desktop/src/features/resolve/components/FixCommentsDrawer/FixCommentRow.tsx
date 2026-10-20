import {
  ROW_INTERACTIVE,
  Checkbox,
  Chip,
  cn,
  inlineMarkdownText,
  TruncatedText,
} from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { firstSentence } from '../ReviewFlow/firstSentence';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { isNoteEntry } from './commentFilter';
import { FIX_COMMENTS_LABEL } from './fixCommentsCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly isIncluded: boolean;
  readonly isSourceShown: boolean;
  readonly onToggle: () => void;
};

export const FixCommentRow = ({ sessionId, entry, isIncluded, isSourceShown, onToggle }: Props) => {
  const note = entry.row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  const isChipShown = isSourceShown && isNoteEntry({ entry });
  return (
    <ObjectMenuArea
      target={{ kind: 'reviewComment', sessionId, threadId: entry.threadId }}
      anchorKey={`fix-comment:${entry.threadId}`}
    >
      <Checkbox
        checked={isIncluded}
        onChange={onToggle}
        ariaLabel={`Include the comment by ${note?.author ?? 'unknown'}`}
        className={cn('w-full gap-3 rounded-md px-2 py-1', ROW_INTERACTIVE)}
        label={
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2 text-meta">
              {isChipShown ? <Chip tone="neutral" label={FIX_COMMENTS_LABEL.noteChip} /> : null}
              {note !== null && (
                <span className="shrink-0 text-muted-foreground">{note.author}</span>
              )}
              {note?.line == null ? null : (
                <span className="shrink-0 font-mono text-faint-foreground">{`:${note.line}`}</span>
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
    </ObjectMenuArea>
  );
};
