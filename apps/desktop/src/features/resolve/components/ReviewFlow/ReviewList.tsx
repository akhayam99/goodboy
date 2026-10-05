import { Button, Eyebrow } from '@goodboy/ui';
import { REVIEW_COMMENT_GROUP_LABEL } from '../../reviewCommentState';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { acceptCountLabel } from '../../reviewBulkCopy';
import { ReviewListRow } from './ReviewListRow';
import type { ReviewGroup } from './useReviewEntries';

type Props = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly focusedThreadId: string | null;
  readonly onSelect: (threadId: string) => void;
  readonly onFix: (threadId: string) => void;
  readonly onAccept: (threadIds: ReadonlyArray<string>) => void;
  readonly isAccepting: boolean;
  readonly checked: ReadonlySet<string>;
  readonly onToggle: (threadId: string) => void;
};

export const ReviewList = ({
  groups,
  focusedThreadId,
  onSelect,
  onFix,
  onAccept,
  isAccepting,
  checked,
  onToggle,
}: Props) => (
  <nav
    aria-label={REVIEW_FLOW_LABEL.list}
    data-selecting={checked.size > 0}
    className="group/select-list flex min-w-0 flex-col gap-5"
  >
    {groups.map((group) => {
      const acceptable = group.entries.filter((entry) => entry.isAcceptable);
      return (
        <section
          key={group.group}
          aria-label={REVIEW_COMMENT_GROUP_LABEL[group.group]}
          className="flex min-w-0 flex-col gap-1"
        >
          <div className="flex min-w-0 items-center justify-between gap-2 px-3">
            <Eyebrow label={`${REVIEW_COMMENT_GROUP_LABEL[group.group]} ${group.entries.length}`} />
            {acceptable.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                isBusy={isAccepting}
                onClick={() => onAccept(acceptable.map((entry) => entry.threadId))}
              >
                {acceptCountLabel({ count: acceptable.length })}
              </Button>
            )}
          </div>
          <ul className="flex min-w-0 flex-col gap-0.5">
            {group.entries.map((entry) => (
              <li key={entry.threadId} className="min-w-0 list-none">
                <ReviewListRow
                  entry={entry}
                  isSelected={entry.threadId === focusedThreadId}
                  onSelect={() => onSelect(entry.threadId)}
                  onFix={entry.isFixable && checked.size === 0 ? () => onFix(entry.threadId) : null}
                  selection={
                    entry.isFixable || entry.isAcceptable
                      ? {
                          isChecked: checked.has(entry.threadId),
                          isSelecting: checked.size > 0,
                          onToggle: () => onToggle(entry.threadId),
                        }
                      : null
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      );
    })}
  </nav>
);
