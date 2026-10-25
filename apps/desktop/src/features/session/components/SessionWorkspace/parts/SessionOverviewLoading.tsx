import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button, EmptyState, ICON_SIZE, PAGE_MEASURE, PageColumn, PANE_RHYTHM } from '@goodboy/ui';
import { useSettleElapsed } from '../../../hooks/useSettleElapsed';
import { SessionOverviewSkeleton } from './SessionOverviewSkeleton';

const OVERVIEW_SETTLE_MS = 10_000;

type Props = {
  readonly isFreshLayout: boolean;
  readonly onRetry: () => void;
};

export const SessionOverviewLoading = ({ isFreshLayout, onRetry }: Props) => {
  const hasSettleElapsed = useSettleElapsed({ ms: OVERVIEW_SETTLE_MS });

  if (!hasSettleElapsed) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <SessionOverviewSkeleton isFreshLayout={isFreshLayout} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageColumn width={PAGE_MEASURE.overview} className={PANE_RHYTHM.headerInset}>
        <EmptyState
          icon={TriangleAlert}
          tone="warning"
          title="This session did not load"
          description="Retry, or reopen it from the board."
          action={
            <Button size="md" onClick={onRetry}>
              <RotateCcw size={ICON_SIZE.control} aria-hidden />
              Retry
            </Button>
          }
          size="page"
        />
      </PageColumn>
    </div>
  );
};
