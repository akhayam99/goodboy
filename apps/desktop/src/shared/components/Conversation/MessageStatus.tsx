import { Tooltip } from '@goodboy/ui';
import { formatAbsoluteDateTime, formatRelativeAge } from '../../utils/relativeDate';
import type { ConversationMessage } from './types';

type Props = {
  readonly message: ConversationMessage;
};

export const MessageStatus = ({ message }: Props) => {
  if (message.status === 'sending') {
    return <span className="text-3xs text-faint-foreground">Sending</span>;
  }
  if (message.status === 'failed') {
    return <span className="text-3xs text-danger">Not posted</span>;
  }
  const age = formatRelativeAge({ fromIso: message.createdAt });
  if (age === '') {
    return null;
  }
  return (
    <Tooltip content={formatAbsoluteDateTime({ iso: message.createdAt })}>
      <span className="text-3xs text-faint-foreground">{age}</span>
    </Tooltip>
  );
};
