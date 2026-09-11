import { Button } from '@goodboy/ui';
import type { ResolveQueueFilter } from '../../../../store/slices/session-view';
import {
  activeFilterLabel,
  needsReviewFilterLabel,
  retryableFilterLabel,
} from '../../resolveQueueCopy';

type Props = {
  readonly filter: ResolveQueueFilter;
  readonly needsReviewCount: number;
  readonly activeCount: number;
  readonly retryableCount: number;
  readonly onChange: (filter: ResolveQueueFilter) => void;
};

export const QueueFilterChips = ({
  filter,
  needsReviewCount,
  activeCount,
  retryableCount,
  onChange,
}: Props) => (
  <div className="flex flex-wrap items-center gap-4">
    <Button
      size="sm"
      variant={filter === 'needs_review' ? 'secondary' : 'ghost'}
      aria-pressed={filter === 'needs_review'}
      onClick={() => onChange('needs_review')}
    >
      {needsReviewFilterLabel({ count: needsReviewCount })}
    </Button>
    <Button
      size="sm"
      variant={filter === 'everything' ? 'secondary' : 'ghost'}
      aria-pressed={filter === 'everything'}
      onClick={() => onChange('everything')}
    >
      {activeFilterLabel({ count: activeCount })}
    </Button>
    <Button
      size="sm"
      variant={filter === 'retryable' ? 'secondary' : 'ghost'}
      aria-pressed={filter === 'retryable'}
      onClick={() => onChange('retryable')}
    >
      {retryableFilterLabel({ count: retryableCount })}
    </Button>
  </div>
);
