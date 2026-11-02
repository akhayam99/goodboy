import { memo } from 'react';
import type { ChatMessage } from '@goodboy/types';
import { UserMessageBubble } from '../../../../shared/components/UserMessageBubble';
import { ChatImageTile } from './ChatImageTile';

type Props = {
  readonly message: ChatMessage;
};

const ChatUserMessageView = ({ message }: Props) => (
  <UserMessageBubble text={message.content}>
    {message.attachments.length === 0 ? null : (
      <div className="flex flex-wrap gap-2">
        {message.attachments.map((attachment) => (
          <ChatImageTile key={attachment.id} attachment={attachment} />
        ))}
      </div>
    )}
  </UserMessageBubble>
);

export const ChatUserMessage = memo(ChatUserMessageView);
