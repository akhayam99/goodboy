import { Button, Notice } from '@goodboy/ui';
import type { ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { formatErrorForHumans } from '../../formatErrorForHumans';
import { LimitContinueAction } from './LimitContinueAction';

type Props = {
  readonly message: string;
  readonly runId?: ProviderRunId | null;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
};

export const TranscriptErrorRow = ({
  message,
  runId = null,
  onRetry,
  isRetrying = false,
}: Props) => {
  const { body, detail } = formatErrorForHumans({ message });
  const hasLimitStop = useAppStore(
    (state) => runId !== null && state.limitStops[runId] !== undefined,
  );

  return (
    <Notice
      tone="danger"
      placement="transcript"
      title={hasLimitStop ? 'The turn stopped' : 'The turn failed'}
      body={body}
      detail={detail}
      iconTestId="transcript-error-icon"
      actions={
        (onRetry !== undefined || hasLimitStop) && (
          <>
            {onRetry !== undefined && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRetry}
                isBusy={isRetrying}
                busyLabel="Retrying"
              >
                Retry
              </Button>
            )}
            {runId !== null && <LimitContinueAction runId={runId} />}
          </>
        )
      }
    />
  );
};
