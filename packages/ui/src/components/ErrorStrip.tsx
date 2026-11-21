import { Button } from './Button';
import { Notice } from './Notice';
import { couldntLoadTitle } from '../couldntLoadTitle';
import { splitErrorMessage } from '../splitErrorMessage';

type Props = {
  readonly labels: ReadonlyArray<string>;
  readonly error: Error | null;
  readonly onRetry?: () => void;
  readonly tone?: 'danger' | 'warning';
  readonly isBusy?: boolean;
};

export const ErrorStrip = ({ labels, error, onRetry, tone = 'danger', isBusy = false }: Props) => {
  if (error === null) {
    return null;
  }

  const { summary, detail } = splitErrorMessage({ message: error.message });

  return (
    <Notice
      tone={tone}
      placement="inline"
      role="alert"
      title={couldntLoadTitle({ labels })}
      body={summary}
      detail={detail}
      actions={
        onRetry === undefined ? undefined : (
          <Button size="sm" variant="secondary" isBusy={isBusy} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  );
};
