import { ChevronDown, ChevronRight } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { RESOLVE_WORD_LABEL } from '../../commentProjection';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { ReviewListRow } from './ReviewListRow';
import type { ReviewGroup } from './useReviewEntries';

type Props = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly focusedThreadId: string | null;
  readonly isDoneOpen: boolean;
  readonly onToggleDone: () => void;
  readonly onSelect: (threadId: string) => void;
  readonly onFix: (threadId: string) => void;
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
            <Eyebrow className="px-3" label={label} />
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
                      entry.state === 'new' && checked.size === 0
                        ? () => onFix(entry.threadId)
                        : null
                    }
                    selection={
                      entry.state === 'new'
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
