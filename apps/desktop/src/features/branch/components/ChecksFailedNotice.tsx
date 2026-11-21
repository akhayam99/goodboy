import { ErrorStrip } from '@goodboy/ui';

type Props = {
  readonly isChecking: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
};

export const ChecksFailedNotice = ({ isChecking, error, onRetry }: Props) => (
  <ErrorStrip
    labels={['checks']}
    error={new Error(error ?? '')}
    isBusy={isChecking}
    onRetry={onRetry}
  />
);
