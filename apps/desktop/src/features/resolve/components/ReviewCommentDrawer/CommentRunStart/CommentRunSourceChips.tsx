import { Plus, X } from '@goodboy/ui/icons';
import { Chip, ICON_SIZE, IconButton } from '@goodboy/ui';
import { commentPlaceOf } from '../../../commentPlaceOf';
import { COMMENT_RUN_COPY } from '../../../commentRunCopy';
import { commentRunSourceLabelOf } from '../../../commentRunSourceLabelOf';
import { entryTitleOf } from '../../ReviewFlow/entryTitle';
import type { ReviewEntry } from '../../ReviewFlow/useReviewEntries';

type Props = {
  readonly picked: ReadonlyArray<ReviewEntry>;
  readonly candidates: ReadonlyArray<ReviewEntry>;
  readonly primaryThreadId: string;
  readonly isDisabled: boolean;
  readonly onAdd: (threadId: string) => void;
  readonly onRemove: (threadId: string) => void;
};

type EntryParams = {
  readonly entry: ReviewEntry;
};

const chipPlaceOf = ({ entry }: EntryParams): string =>
  commentPlaceOf({
    path: entry.row.reviewerNote?.path ?? null,
    line: entry.row.reviewerNote?.line ?? null,
  }) ?? COMMENT_RUN_COPY.general;

export const CommentRunSourceChips = ({
  picked,
  candidates,
  primaryThreadId,
  isDisabled,
  onAdd,
  onRemove,
}: Props) => (
  <div role="group" aria-label={COMMENT_RUN_COPY.sources} className="flex min-w-0 flex-col gap-2">
    <p className="text-meta text-faint-foreground">{COMMENT_RUN_COPY.sources}</p>
    <ul className="flex min-w-0 flex-wrap items-center gap-2">
      {picked.map((entry) => {
        const place = chipPlaceOf({ entry });
        return (
          <li
            key={entry.threadId}
            className="flex min-w-0"
            data-comment-run-source={entry.threadId}
          >
            <Chip
              tone="neutral"
              kind="reference"
              title={entryTitleOf({ entry })}
              label={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate font-mono">{place}</span>
                  <span className="shrink-0 text-faint-foreground">
                    {commentRunSourceLabelOf({ thread: entry.row.thread })}
                  </span>
                </span>
              }
              trailing={
                entry.threadId === primaryThreadId ? undefined : (
                  <IconButton
                    icon={X}
                    size="xs"
                    variant="ghost"
                    label={COMMENT_RUN_COPY.remove({ place })}
                    disabled={isDisabled}
                    onClick={() => onRemove(entry.threadId)}
                  />
                )
              }
            />
          </li>
        );
      })}
      {candidates.map((entry) => {
        const place = chipPlaceOf({ entry });
        return (
          <li
            key={entry.threadId}
            className="flex min-w-0"
            data-comment-run-candidate={entry.threadId}
          >
            <Chip
              as="button"
              tone="neutral"
              kind="reference"
              emphasis="subtle"
              title={entryTitleOf({ entry })}
              ariaLabel={COMMENT_RUN_COPY.add({ place })}
              disabled={isDisabled}
              icon={<Plus size={ICON_SIZE.row} aria-hidden />}
              label={<span className="min-w-0 truncate font-mono">{place}</span>}
              onClick={() => onAdd(entry.threadId)}
            />
          </li>
        );
      })}
    </ul>
  </div>
);
