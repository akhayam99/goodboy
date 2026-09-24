import { SegmentedTabs } from '@goodboy/ui';
import type { ResolveQueueFilter } from '../../../../store/slices/session-view';
import { RESOLVE_QUEUE_FILTER_LABEL } from '../../resolveQueueCopy';

type Props = {
  readonly filter: ResolveQueueFilter;
  readonly needsReviewCount: number;
  readonly activeCount: number;
  readonly retryableCount: number;
  readonly onChange: (filter: ResolveQueueFilter) => void;
};

type FilterOptionParams = {
  readonly value: ResolveQueueFilter;
  readonly count: number;
};

const filterOption = ({ value, count }: FilterOptionParams) => ({
  value,
  label: RESOLVE_QUEUE_FILTER_LABEL[value],
  ...(count > 0 && { badge: count }),
});

export const QueueFilterChips = ({
  filter,
  needsReviewCount,
  activeCount,
  retryableCount,
  onChange,
}: Props) => (
  <SegmentedTabs
    ariaLabel="Comment filter"
    size="sm"
    className="w-max shrink-0"
    value={filter}
    onChange={onChange}
    options={[
      filterOption({ value: 'needs_review', count: needsReviewCount }),
      filterOption({ value: 'everything', count: activeCount }),
      filterOption({ value: 'retryable', count: retryableCount }),
    ]}
  />
);
