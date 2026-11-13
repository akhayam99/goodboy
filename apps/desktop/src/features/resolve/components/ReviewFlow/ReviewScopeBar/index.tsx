import type { ReactNode } from 'react';
import { cn, SegmentedTabs } from '@goodboy/ui';
import type { CommentStateCounts } from '../../../commentGroupsView';
import type { ReviewEntryCounts } from '../useReviewEntries';

export type CommentScope = 'branch' | 'notes' | 'comments';

export type CommentState = 'open' | 'resolved';

type Props = {
  readonly scope: CommentScope;
  readonly onScope: (next: CommentScope) => void;
  readonly state: CommentState;
  readonly onState: (next: CommentState) => void;
  readonly counts: ReviewEntryCounts;
  readonly stateCounts: CommentStateCounts;
  readonly hostLabel: string | null;
  readonly trailing?: ReactNode;
};

type BadgeParams = {
  readonly count: number;
};

type StateBadgeParams = BadgeParams & {
  readonly isWarm?: boolean;
};

const stateBadge = ({ count, isWarm = false }: StateBadgeParams) => (
  <span className={cn('tabular-nums', isWarm ? 'text-warning' : 'text-faint-foreground')}>
    {count}
  </span>
);

const countBadge = ({ count }: BadgeParams) =>
  count === 0 ? undefined : <span className="tabular-nums text-faint-foreground">{count}</span>;

export const ReviewScopeBar = ({
  scope,
  onScope,
  state,
  onState,
  counts,
  stateCounts,
  hostLabel,
  trailing = null,
}: Props) => {
  const isSourceSwitchShown = hostLabel !== null && counts.notes > 0 && counts.host > 0;
  const isStateSwitchShown = stateCounts.open + stateCounts.resolved > 0;
  if (!isSourceSwitchShown && !isStateSwitchShown && trailing == null) {
    return null;
  }
  return (
    <div
      data-slot="review-scope-bar"
      className="flex min-h-9 min-w-0 shrink-0 flex-wrap items-center gap-2"
    >
      {isSourceSwitchShown ? (
        <SegmentedTabs<CommentScope>
          ariaLabel="Comment source"
          size="xs"
          value={scope}
          onChange={onScope}
          options={[
            { value: 'branch', label: 'All', badge: countBadge({ count: counts.all }) },
            { value: 'notes', label: 'Notes', badge: countBadge({ count: counts.notes }) },
            {
              value: 'comments',
              label: `On ${hostLabel}`,
              badge: countBadge({ count: counts.host }),
            },
          ]}
        />
      ) : null}
      {isStateSwitchShown ? (
        <SegmentedTabs<CommentState>
          ariaLabel="Comment state"
          size="xs"
          value={state}
          onChange={onState}
          options={[
            {
              value: 'open',
              label: 'Open',
              badge: stateBadge({ count: stateCounts.open, isWarm: stateCounts.needYou > 0 }),
            },
            {
              value: 'resolved',
              label: 'Resolved',
              badge: stateBadge({ count: stateCounts.resolved }),
            },
          ]}
        />
      ) : null}
      {trailing == null ? null : <div className="min-w-0 flex-1">{trailing}</div>}
    </div>
  );
};
