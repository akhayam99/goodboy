import { ChevronDown, ChevronRight } from 'lucide-react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Button, Eyebrow, ROW_INTERACTIVE, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import {
  RESOLVE_GROUP_LABEL,
  leftOpenGroupLabel,
  type ResolveGroup,
} from '../../commentProjection';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { acceptCountLabel } from '../../reviewBulkCopy';
import type { ReviewTally } from '../../reviewTally';
import { ReviewListRow } from './ReviewListRow';
import type { ReviewEntry, ReviewGroup } from './useReviewEntries';

type Props = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly tally: ReviewTally;
  readonly focusedThreadId: string | null;
  readonly openGroups: ReadonlySet<ResolveGroup>;
  readonly onToggleGroup: (group: ResolveGroup) => void;
  readonly onSelect: (threadId: string) => void;
  readonly onFix: (threadId: string) => void;
  readonly onAccept: (threadIds: ReadonlyArray<string>) => void;
  readonly onPush: (() => void) | null;
  readonly isAccepting: boolean;
  readonly checked: ReadonlySet<string>;
  readonly onToggle: (threadId: string) => void;
};

const COLLAPSIBLE: ReadonlySet<ResolveGroup> = new Set(['done', 'left_open']);

const countOf = ({
  group,
  tally,
}: {
  readonly group: ResolveGroup;
  readonly tally: ReviewTally;
}): number => {
  switch (group) {
    case 'needs_you':
      return tally.needsYou;
    case 'working':
      return tally.working;
    case 'ready_to_push':
      return tally.readyToPush;
    case 'open':
      return tally.open;
    case 'done':
      return tally.done;
    case 'left_open':
      return tally.leftOpen;
    default: {
      const exhaustive: never = group;
      return exhaustive;
    }
  }
};

const labelOf = ({
  group,
  entries,
}: {
  readonly group: ResolveGroup;
  readonly entries: ReadonlyArray<ReviewEntry>;
}): string => {
  if (group !== 'left_open') {
    return RESOLVE_GROUP_LABEL[group];
  }
  const kind = entries[0]?.row.thread.sourceKind ?? 'github';
  return leftOpenGroupLabel({ sourceLabel: REVIEW_SOURCE_LABEL[kind] });
};

export const ReviewList = ({
  groups,
  tally,
  focusedThreadId,
  openGroups,
  onToggleGroup,
  onSelect,
  onFix,
  onAccept,
  onPush,
  isAccepting,
  checked,
  onToggle,
}: Props) => (
  <nav
    aria-label={REVIEW_FLOW_LABEL.list}
    data-selecting={checked.size > 0}
    className="group/select-list flex min-w-0 flex-col gap-5"
  >
    {groups.map(({ group, entries }) => {
      const name = labelOf({ group, entries });
      const label = `${name} ${countOf({ group, tally })}`;
      const acceptable = group === 'needs_you' ? entries.filter((entry) => entry.isAcceptable) : [];
      const isCollapsible = COLLAPSIBLE.has(group);
      const isOpen = openGroups.has(group);
      const isShown = !isCollapsible || isOpen;
      const Chevron = isOpen ? ChevronDown : ChevronRight;
      return (
        <section
          key={group}
          aria-label={name}
          className={cn('flex min-w-0 flex-col gap-1', group === 'left_open' && 'opacity-80')}
        >
          {isCollapsible ? (
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => onToggleGroup(group)}
              className={cn('flex items-center gap-1 rounded-sm px-3 text-left', ROW_INTERACTIVE)}
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
                  size="xs"
                  variant="secondary"
                  isBusy={isAccepting}
                  onClick={() => onAccept(acceptable.map((entry) => entry.threadId))}
                >
                  {acceptCountLabel({ count: acceptable.length })}
                </Button>
              )}
              {group === 'ready_to_push' && onPush !== null && (
                <Button size="xs" variant="ghost" onClick={onPush}>
                  {`Push ${tally.readyToPush}`}
                </Button>
              )}
            </div>
          )}
          {isShown && (
            <ul className="flex min-w-0 flex-col gap-0.5">
              {entries.map((entry) => (
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
