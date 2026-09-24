import { Button } from './Button';
import { Notice } from './Notice';
import { splitErrorMessage } from '../splitErrorMessage';

type Props = {
  readonly label: string;
  readonly error: Error | null;
  readonly onRetry: () => void;
};

export const ErrorStrip = ({ label, error, onRetry }: Props) => {
  if (error === null) {
    return null;
  }

  const { summary, detail } = splitErrorMessage({ message: error.message });

  return (
    <Notice
      tone="danger"
      placement="banner"
      role="alert"
      title={`Couldn't load ${label}`}
      body={summary}
      detail={detail}
      actions={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      }
    />
  );
};
