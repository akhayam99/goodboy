import { useState } from 'react';
import { Button, ErrorStrip, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const STEPS_MISSING = 'The run is still in this session, but its steps are missing.';

type Props = {
  readonly sessionId: SessionId;
  readonly onBack: () => void;
};

export const RunMetadataMissing = ({ sessionId, onBack }: Props) => {
  const reloadSessionWorkflows = useAppStore((state) => state.reloadSessionWorkflows);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retry = async () => {
    setIsPending(true);
    setError(null);
    try {
      await reloadSessionWorkflows({ sessionId });
    } catch (failure) {
      setError(formatError(failure));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      <ErrorStrip
        labels={['this run']}
        error={new Error(error ?? STEPS_MISSING)}
        isBusy={isPending}
        onRetry={() => void retry()}
      />
      <Button size="sm" variant="ghost" onClick={onBack}>
        Back
      </Button>
    </div>
  );
};
