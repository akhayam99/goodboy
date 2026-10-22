import { useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ReportedError } from '../../../../store/slices/notifications/reportedError';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly title: string;
};

type ErrorParams = {
  readonly error: unknown;
};

const messageOf = ({ error }: ErrorParams): string =>
  error instanceof Error ? error.message : String(error);

export const DoneRetry = ({ sessionId, agentId, title }: Props) => {
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const [isBusy, setIsBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const isRunning = useRef(false);

  const retry = async (): Promise<void> => {
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;
    setIsBusy(true);
    setFailure(null);
    try {
      await loadAutoTrees({ sessionId });
      await continueStoppedAgent({ sessionId, agentId });
    } catch (error) {
      if (!(error instanceof ReportedError)) {
        setFailure(messageOf({ error }));
      }
    } finally {
      isRunning.current = false;
      setIsBusy(false);
    }
  };

  return (
    <span className="flex min-w-0 items-center gap-2">
      {failure === null ? null : (
        <span role="alert" className="flex min-w-0 items-center gap-1 text-label text-danger">
          <CircleAlert size={ICON_SIZE.control} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">{failure}</span>
        </span>
      )}
      <Button
        size="sm"
        variant="secondary"
        aria-label={`Retry: ${title}`}
        isBusy={isBusy}
        onClick={() => void retry()}
      >
        Retry
      </Button>
    </span>
  );
};
