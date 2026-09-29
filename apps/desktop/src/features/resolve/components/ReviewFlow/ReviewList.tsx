import { Eyebrow } from '@goodboy/ui';
import { REVIEW_COMMENT_GROUP_LABEL } from '../../reviewCommentState';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { ReviewListRow } from './ReviewListRow';
import type { ReviewGroup } from './useReviewEntries';

type Props = {
  readonly groups: ReadonlyArray<ReviewGroup>;
  readonly focusedThreadId: string | null;
  readonly onSelect: (threadId: string) => void;
  readonly onFix: (threadId: string) => void;
};

export const ReviewList = ({ groups, focusedThreadId, onSelect, onFix }: Props) => (
  <nav aria-label={REVIEW_FLOW_LABEL.list} className="flex min-w-0 flex-col gap-5">
    {groups.map((group) => (
      <section
        key={group.group}
        aria-label={REVIEW_COMMENT_GROUP_LABEL[group.group]}
        className="flex min-w-0 flex-col gap-1"
      >
        <Eyebrow
          className="px-2.5"
          label={`${REVIEW_COMMENT_GROUP_LABEL[group.group]} ${group.entries.length}`}
        />
        <ul className="flex min-w-0 flex-col gap-0.5">
          {group.entries.map((entry) => (
            <li key={entry.threadId} className="min-w-0 list-none">
              <ReviewListRow
                entry={entry}
                isSelected={entry.threadId === focusedThreadId}
                onSelect={() => onSelect(entry.threadId)}
                onFix={entry.state === 'new' ? () => onFix(entry.threadId) : null}
              />
            </li>
          ))}
        </ul>
      </section>
    ))}
  </nav>
);
