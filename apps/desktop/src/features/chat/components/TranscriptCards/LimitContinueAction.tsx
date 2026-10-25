import { Button } from '@goodboy/ui';
import type { ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatClock } from '../../../../shared/utils/time/formatClock';

type Props = {
  readonly runId: ProviderRunId;
};

export const LimitContinueAction = ({ runId }: Props) => {
  const stop = useAppStore((state) => state.limitStops[runId]);
  const continueAfterLimit = useAppStore((state) => state.continueAfterLimit);
  const cancelLimitContinue = useAppStore((state) => state.cancelLimitContinue);

  if (stop === undefined) {
    return null;
  }
  const at = formatClock({ at: stop.resetAtMs });
  if (stop.isScheduled) {
    return (
      <>
        <span className="text-meta text-muted-foreground">
          {`Continues at ${at} if Goodboy stays open`}
        </span>
        <Button size="sm" variant="ghost" onClick={() => cancelLimitContinue({ runId })}>
          Cancel
        </Button>
      </>
    );
  }
  return (
    <Button size="sm" variant="secondary" onClick={() => continueAfterLimit({ runId })}>
      {`Continue at ${at}`}
    </Button>
  );
};
