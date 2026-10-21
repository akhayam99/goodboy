import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { TEXT_ROLE, cn } from '@goodboy/ui';
import { countSlotText } from '../../../../shared/utils/countSlotText';
import {
  RESOLVE_GROUP_LABEL,
  leftOpenGroupLabel,
  type ResolveGroup,
} from '../../commentProjection';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { ReviewListRow } from './ReviewListRow';
import type { ReviewEntry, ReviewGroup } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly focusedThreadId: string | null;
  readonly onSelect: (threadId: string) => void;
  readonly checked: ReadonlySet<string>;
  readonly onToggle: (threadId: string) => void;
};

type LabelParams = {
  readonly group: ResolveGroup;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

const labelOf = ({ group, entries }: LabelParams): string => {
  if (group !== 'left_open') {
    return RESOLVE_GROUP_LABEL[group];
  }
  const kind = entries[0]?.row.thread.sourceKind ?? 'github';
  return leftOpenGroupLabel({ sourceLabel: REVIEW_SOURCE_LABEL[kind] });
};

type MixedParams = {
  readonly groups: ReadonlyArray<ReviewGroup>;
};

const isMixedOf = ({ groups }: MixedParams): boolean => {
  const entries = groups.flatMap((group) => group.entries);
  const notes = entries.filter((entry) => entry.row.thread.originKind === 'diff_comment').length;
  return notes > 0 && notes < entries.length;
};

export const ReviewList = ({
  sessionId,
  groups,
  focusedThreadId,
  onSelect,
  checked,
  onToggle,
}: Props) => {
  const isSourceShown = isMixedOf({ groups });
  return (
    <nav
      aria-label={REVIEW_FLOW_LABEL.list}
      data-selecting={checked.size > 0}
      className="group/select-list flex min-w-0 flex-col gap-4"
    >
      {groups.map(({ group, entries }) => {
        const name = labelOf({ group, entries });
        const count = countSlotText({ count: entries.length, isBesideGlyph: true });
        return (
          <section
            key={group}
            aria-label={name}
            className={cn('flex min-w-0 flex-col gap-1', group === 'left_open' && 'opacity-80')}
          >
            {groups.length < 2 ? null : (
              <h2 className="flex h-7 min-w-0 items-center gap-2 px-3 text-row">
                <span className={cn('truncate', TEXT_ROLE.secondary)}>{name}</span>
                {count === null ? null : (
                  <span data-group-count="" className={cn('tabular-nums', TEXT_ROLE.hint)}>
                    <span className="sr-only"> </span>
                    {count}
                  </span>
                )}
              </h2>
            )}
            <ul className="flex min-w-0 flex-col gap-0.5">
              {entries.map((entry) => (
                <li key={entry.threadId} className="min-w-0 list-none">
                  <ReviewListRow
                    sessionId={sessionId}
                    entry={entry}
                    isSelected={entry.threadId === focusedThreadId}
                    isSourceShown={isSourceShown}
                    onSelect={() => onSelect(entry.threadId)}
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
};
