import { SegmentedTabs } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { FixCommentsButton } from '../FixCommentsButton';
import type { ReviewEntryCounts } from './useReviewEntries';

export type CommentScope = 'branch' | 'notes' | 'comments';

export type CommentState = 'open' | 'resolved';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly scope: CommentScope;
  readonly onScope: (next: CommentScope) => void;
  readonly state: CommentState;
  readonly onState: (next: CommentState) => void;
  readonly counts: ReviewEntryCounts;
  readonly hostLabel: string | null;
};

type BadgeParams = {
  readonly count: number;
};

const countBadge = ({ count }: BadgeParams) =>
  count === 0 ? undefined : <span className="tabular-nums text-faint-foreground">{count}</span>;

export const ReviewScopeBar = ({
  sessionId,
  mountId,
  scope,
  onScope,
  state,
  onState,
  counts,
  hostLabel,
}: Props) => (
  <div
    data-slot="review-scope-bar"
    className="flex min-w-0 flex-wrap items-center justify-between gap-2"
  >
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <SegmentedTabs<CommentScope>
        ariaLabel="Comment source"
        size="xs"
        value={scope}
        onChange={onScope}
        options={[
          { value: 'branch', label: 'All', badge: countBadge({ count: counts.all }) },
          { value: 'notes', label: 'Notes', badge: countBadge({ count: counts.notes }) },
          ...(hostLabel === null
            ? []
            : [
                {
                  value: 'comments' as const,
                  label: `On ${hostLabel}`,
                  badge: countBadge({ count: counts.host }),
                },
              ]),
        ]}
      />
      <SegmentedTabs<CommentState>
        ariaLabel="Comment state"
        size="xs"
        value={state}
        onChange={onState}
        options={[
          { value: 'open', label: 'Open' },
          { value: 'resolved', label: 'Resolved' },
        ]}
      />
    </div>
    <FixCommentsButton sessionId={sessionId} mountId={mountId} />
  </div>
);
