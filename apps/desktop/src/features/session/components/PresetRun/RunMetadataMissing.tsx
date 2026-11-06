import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, EmptyState, ICON_SIZE, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

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
    <EmptyState
      size="section"
      icon={CONCEPT_ICONS.workflows}
      title="This run could not be read"
      description={error ?? 'The run is still in this session. Its steps did not load.'}
      action={
        <>
          <Button size="sm" variant="secondary" disabled={isPending} onClick={() => void retry()}>
            Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft size={ICON_SIZE.control} aria-hidden />
            Back
          </Button>
        </>
      }
    />
  );
};
