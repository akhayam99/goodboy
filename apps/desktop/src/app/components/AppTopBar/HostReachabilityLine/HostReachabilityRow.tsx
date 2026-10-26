import { useEffect, useState } from 'react';
import { Button, Notice } from '@goodboy/ui';
import { HOST_BACKOFF } from '../../../../shared/utils/hostBackoff';
import { NAMES } from '../../../../shared/utils/names';
import { formatClock } from '../../../../shared/utils/time/formatClock';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { useAppStore } from '../../../../store';
import type {
  HostReachability,
  ReachabilityHost,
} from '../../../../store/slices/host-reachability/types';

const RECOVERED_SHOWN_MS = 4_000;

const MINUTE_MS = 60_000;

type Props = {
  readonly host: ReachabilityHost;
  readonly entry: HostReachability;
};

export const HostReachabilityRow = ({ host, entry }: Props) => {
  const retryHost = useAppStore((state) => state.retryHost);
  const dismissRecoveredHost = useAppStore((state) => state.dismissRecoveredHost);
  const [isRetrying, setIsRetrying] = useState(false);
  const label = integrationLabel({ provider: host });
  const isRecovered = entry.status === 'recovered';

  useEffect(() => {
    if (!isRecovered) {
      return;
    }
    const timer = window.setTimeout(() => dismissRecoveredHost({ host }), RECOVERED_SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [dismissRecoveredHost, host, isRecovered]);

  if (entry.status === 'recovered') {
    return (
      <Notice
        tone="success"
        placement="banner"
        role="status"
        title={`${label} is reachable again`}
      />
    );
  }

  const retry = async () => {
    setIsRetrying(true);
    try {
      await retryHost({ host });
    } finally {
      setIsRetrying(false);
    }
  };

  const isBackedOff = entry.failures >= HOST_BACKOFF.slowAfterUnreachable;
  return (
    <Notice
      tone="warning"
      placement="banner"
      role="status"
      title={`${label} unreachable since ${formatClock({ at: entry.since })}`}
      body={
        isBackedOff
          ? `Checking again every ${HOST_BACKOFF.slowPollMs / MINUTE_MS} minutes.`
          : undefined
      }
      actions={
        <Button
          variant="secondary"
          size="sm"
          isBusy={isRetrying}
          busyLabel="Checking"
          onClick={() => void retry()}
        >
          {NAMES.retry}
        </Button>
      }
    />
  );
};
