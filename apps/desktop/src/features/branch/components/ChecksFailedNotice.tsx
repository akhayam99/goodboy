import { Button, Notice } from '@goodboy/ui';

type Props = {
  readonly isChecking: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const ChecksFailedNotice = ({ isChecking, error, onRetry }: Props) => (
  <Notice
    tone="danger"
    placement="inline"
    role="alert"
    title="Couldn't read checks"
    detail={error}
    actions={
      <Button variant="secondary" size="sm" isBusy={isChecking} onClick={onRetry}>
        Retry
      </Button>
    }
  />
);
