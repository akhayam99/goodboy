import type { ProviderId } from '@goodboy/types';
import { Button, Notice } from '@goodboy/ui';
import { formatErrorForHumans } from '../../../formatErrorForHumans';

type Props = {
  readonly message: string;
  readonly providerId: ProviderId;
  readonly onRetry?: () => void;
};

export const ComposerErrorNotice = ({ message, providerId, onRetry }: Props) => {
  const { body, detail } = formatErrorForHumans({ message, providerId });

  return (
    <Notice
      tone="danger"
      placement="inline"
      role="alert"
      title="Couldn't send the message"
      body={body}
      detail={detail}
      actions={
        onRetry !== undefined && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  );
};
