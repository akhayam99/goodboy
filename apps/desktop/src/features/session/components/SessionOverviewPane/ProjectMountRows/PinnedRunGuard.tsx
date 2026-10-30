import { useState } from 'react';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { PINNED_RUN_COPY } from '../../../../workflows/pinnedRunCopy';
import type { PinnedRunsView } from '../../../hooks/usePinnedRuns';

type Props = {
  readonly pinnedRuns: PinnedRunsView;
  readonly isBusy: boolean;
};

export const PinnedRunGuard = ({ pinnedRuns, isBusy }: Props) => {
  const stopWorkflowRunNow = useAppStore((state) => state.stopWorkflowRunNow);
  const [isStopping, setIsStopping] = useState(false);

  const stop = async (): Promise<void> => {
    setIsStopping(true);
    try {
      for (const runId of pinnedRuns.runIds) {
        await stopWorkflowRunNow(pinnedRuns.sessionId, runId);
      }
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div data-pinned-run-guard="" className="flex min-w-0 flex-col items-start gap-2">
      <p className="break-words text-muted-foreground">
        {PINNED_RUN_COPY.warning({
          label: pinnedRuns.firstLabel ?? '',
          count: pinnedRuns.runIds.length,
        })}
      </p>
      <Button
        size="xs"
        variant="secondary"
        isBusy={isStopping}
        disabled={isBusy || isStopping}
        onClick={() => void stop()}
      >
        {PINNED_RUN_COPY.stopRunFirst}
      </Button>
    </div>
  );
};
