import { useState } from 'react';
import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly onRetry: () => Promise<void>;
};

export const CalendarProblem = ({ title, body, onRetry }: Props) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title={title}
      body={body}
      actions={
        <Button
          size="sm"
          variant="secondary"
          isBusy={isRetrying}
          busyLabel="Trying"
          onClick={() => void retry()}
        >
          Retry
        </Button>
      }
    />
  );
};
