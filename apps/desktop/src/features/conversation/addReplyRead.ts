import type { ChatMessage } from '@goodboy/types';

type Params = {
  readonly message: ChatMessage;
  readonly path: string;
};

export const addReplyRead = ({ message, path }: Params): ChatMessage => {
  if (message.status !== 'streaming' || message.reads.includes(path)) {
    return message;
  }
  return { ...message, reads: [...message.reads, path] };
};
