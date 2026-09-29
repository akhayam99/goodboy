import { Tooltip } from '@goodboy/ui';
import { formatAge } from '../../utils/time/formatAge';
import { formatDateTime } from '../../utils/time/formatDateTime';
import type { ConversationMessage } from './types';
import { useNow } from '../../hooks/useNow';

type Props = {
  readonly message: ConversationMessage;
};

export const MessageStatus = ({ message }: Props) => {
  const now = useNow(30_000);
  if (message.status === 'sending') {
    return <span className="text-meta text-faint-foreground">Sending</span>;
  }
  if (message.status === 'failed') {
    return <span className="text-meta text-danger">Not posted</span>;
  }
  const age = formatAge({ from: message.createdAt, now });
  if (age === '') {
    return null;
  }
  return (
    <Tooltip content={formatDateTime({ at: message.createdAt, hasYear: true })}>
      <span className="text-meta text-faint-foreground">{age}</span>
    </Tooltip>
  );
};
