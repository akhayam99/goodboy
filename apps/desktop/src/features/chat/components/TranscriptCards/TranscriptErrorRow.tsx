import { Button, Notice } from '@goodboy/ui';
import { formatErrorForHumans } from '../../formatErrorForHumans';

type Props = {
  readonly message: string;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
};

export const TranscriptErrorRow = ({ message, onRetry, isRetrying = false }: Props) => {
  const { body, detail } = formatErrorForHumans({ message });

  return (
    <Notice
      tone="danger"
      placement="transcript"
      title="The turn stopped"
      body={body}
      detail={detail}
      iconTestId="transcript-error-icon"
      actions={
        onRetry !== undefined && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRetry}
            isBusy={isRetrying}
            busyLabel="Retrying"
          >
            Retry
          </Button>
        )
      }
    />
  );
};
