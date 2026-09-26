import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, StatusDot } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../store';
import { formatRelativeAge } from '../../../../shared/utils/relativeDate';

type Props = {
  readonly sessionId: SessionId;
};

export const StatusLine = ({ sessionId }: Props) => {
  const { status, lastUpdate, lastAttempt } = useSummarizerStatus(sessionId);
  const retrySummarizer = useAppStore((state) => state.retrySummarizer);
  const [isRetrying, setIsRetrying] = useState(false);

  if (status === 'running') {
    return (
      <p
        role="status"
        className="flex h-6 items-center gap-1.5 text-secondary text-faint-foreground"
      >
        <StatusDot tone="info" size="sm" pulsing ariaLabel="Updating" />
        Updating…
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p
        role="status"
        className="flex h-6 items-center gap-1.5 text-secondary text-faint-foreground"
      >
        <AlertTriangle size={11} aria-hidden className="shrink-0 text-danger" />
        Couldn't update
        {lastAttempt === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={isRetrying}
            onClick={() => {
              setIsRetrying(true);
              retrySummarizer(sessionId);
            }}
          >
            Retry
          </Button>
        )}
      </p>
    );
  }

  if (lastUpdate === null) {
    return null;
  }

  return (
    <p className="flex h-6 items-center text-secondary text-faint-foreground">
      {`Updated ${formatRelativeAge({ fromIso: lastUpdate })}`}
    </p>
  );
};
