import { memo } from 'react';
import { Markdown } from '@goodboy/ui';
import type { ChatMessage } from '@goodboy/types';
import { ChatImageTile } from './ChatImageTile';

type Props = {
  readonly message: ChatMessage;
};

const ChatUserMessageView = ({ message }: Props) => (
  <div
    data-chat-message="user"
    className="flex min-w-0 max-w-[80%] flex-col gap-2 self-end wrap-anywhere rounded-lg bg-subtle px-3 py-2 text-prose text-foreground"
  >
    {message.content === '' ? null : <Markdown text={message.content} />}
    {message.attachments.length === 0 ? null : (
      <div className="flex flex-wrap gap-2">
        {message.attachments.map((attachment) => (
          <ChatImageTile key={attachment.id} attachment={attachment} />
        ))}
      </div>
    )}
  </div>
);

export const ChatUserMessage = memo(ChatUserMessageView);
