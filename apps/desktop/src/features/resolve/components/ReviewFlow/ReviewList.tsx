import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Eyebrow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RESOLVE_WORD_LABEL } from '../../commentProjection';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { acceptCountLabel } from '../../reviewBulkCopy';
import { ReviewListRow } from './ReviewListRow';
import type { ReviewGroup } from './useReviewEntries';

type Props = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly focusedThreadId: string | null;
  readonly isDoneOpen: boolean;
  readonly onToggleDone: () => void;
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
  isDoneOpen,
  onToggleDone,
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
      const label = `${RESOLVE_WORD_LABEL[group.word]} ${group.entries.length}`;
      const acceptable =
        group.word === 'ready' ? group.entries.filter((entry) => entry.isAcceptable) : [];
      const isCollapsible = group.word === 'done';
      const isShown = !isCollapsible || isDoneOpen;
      const Chevron = isDoneOpen ? ChevronDown : ChevronRight;
      return (
        <section
          key={group.word}
          aria-label={RESOLVE_WORD_LABEL[group.word]}
          className="flex min-w-0 flex-col gap-1"
        >
          {isCollapsible ? (
            <button
              type="button"
              aria-expanded={isDoneOpen}
              onClick={onToggleDone}
              className="flex items-center gap-1 rounded-sm px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Chevron
                size={ICON_SIZE.row}
                aria-hidden
                className="shrink-0 text-faint-foreground"
              />
              <Eyebrow label={label} />
            </button>
          ) : (
            <div className="flex min-w-0 items-center justify-between gap-2 px-3">
              <Eyebrow label={label} />
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
          )}
          {isShown && (
            <ul className="flex min-w-0 flex-col gap-0.5">
              {group.entries.map((entry) => (
                <li key={entry.threadId} className="min-w-0 list-none">
                  <ReviewListRow
                    entry={entry}
                    isSelected={entry.threadId === focusedThreadId}
                    onSelect={() => onSelect(entry.threadId)}
                    onFix={
                      entry.isFixable && checked.size === 0 ? () => onFix(entry.threadId) : null
                    }
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
          )}
        </section>
      );
    })}
  </nav>
);
