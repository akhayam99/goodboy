import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
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
    return <SessionOverviewSkeleton isFreshLayout={isFreshLayout} />;
  }

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={TriangleAlert}
        tone="warning"
        title="This session did not finish loading"
        description="Its agents and plans have not arrived. Nothing here is missing on purpose."
        action={
          <Button size="md" onClick={onRetry}>
            <RotateCcw size={16} aria-hidden />
            Retry
          </Button>
        }
      />
    </div>
  );
};
