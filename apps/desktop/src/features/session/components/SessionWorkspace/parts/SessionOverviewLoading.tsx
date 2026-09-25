import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { useSettleElapsed } from '../../../hooks/useSettleElapsed';
import { SessionOverviewSkeleton } from './SessionOverviewSkeleton';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { PageCrumbRow } from '../../../../../shared/components/PaneShell/PageCrumbRow';

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
        <PageCrumbRow />
        <div className="min-h-0 flex-1">
          <SessionOverviewSkeleton isFreshLayout={isFreshLayout} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageCrumbRow />
      <div className="flex min-h-0 flex-1 items-center justify-center">
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
        />
      </div>
    </div>
  );
};
