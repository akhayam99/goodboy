import { Plus, X } from '@goodboy/ui/icons';
import { Chip, ICON_SIZE, IconButton } from '@goodboy/ui';
import { FormSection } from '../../../../../shared/components/FormSection';
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

type HostParams = {
  readonly picked: ReadonlyArray<ReviewEntry>;
};

const chipPlaceOf = ({ entry }: EntryParams): string =>
  commentPlaceOf({
    path: entry.row.reviewerNote?.path ?? null,
    line: entry.row.reviewerNote?.line ?? null,
  }) ?? COMMENT_RUN_COPY.general;

const sharedHostOf = ({ picked }: HostParams): string | null => {
  const labels = new Set(
    picked.map((entry) => commentRunSourceLabelOf({ thread: entry.row.thread })),
  );
  const [only = null] = [...labels];
  return labels.size === 1 && only !== COMMENT_RUN_COPY.note ? only : null;
};

export const CommentRunSourceChips = ({
  picked,
  candidates,
  primaryThreadId,
  isDisabled,
  onAdd,
  onRemove,
}: Props) => {
  const host = sharedHostOf({ picked });
  return (
    <FormSection
      label={COMMENT_RUN_COPY.what}
      help={
        host === null ? COMMENT_RUN_COPY.sources : COMMENT_RUN_COPY.sourcesFrom({ label: host })
      }
    >
      <ul
        aria-label={COMMENT_RUN_COPY.sources}
        className="flex min-w-0 flex-wrap items-center gap-2"
      >
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
                    {host === null ? (
                      <span className="shrink-0 text-faint-foreground">
                        {commentRunSourceLabelOf({ thread: entry.row.thread })}
                      </span>
                    ) : null}
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
      </ul>
      {candidates.length === 0 ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-meta text-faint-foreground">{COMMENT_RUN_COPY.addCaption}</span>
          <ul
            aria-label={COMMENT_RUN_COPY.more}
            className="flex min-w-0 flex-wrap items-center gap-2"
          >
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
      )}
    </FormSection>
  );
};
