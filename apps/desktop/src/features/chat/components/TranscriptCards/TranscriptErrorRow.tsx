import { TurnErrorCallout } from '../TurnErrorCallout';

type Props = {
  readonly message: string;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
};

export const TranscriptErrorRow = ({ message, onRetry, isRetrying = false }: Props) => (
  <TurnErrorCallout
    message={message}
    iconTestId="transcript-error-icon"
    retryAction={
      onRetry != null
        ? {
            label: isRetrying ? 'retrying' : 'retry',
            onClick: onRetry,
            disabled: isRetrying === true,
          }
        : undefined
    }
  />
);
