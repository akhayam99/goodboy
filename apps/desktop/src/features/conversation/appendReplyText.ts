import type { ChatMessage } from '@goodboy/types';

type Params = {
  readonly message: ChatMessage;
  readonly delta: string;
};

export const appendReplyText = ({ message, delta }: Params): ChatMessage => {
  if (message.status !== 'streaming') {
    return message;
  }
  return { ...message, content: `${message.content}${delta}` };
};
