import type { ChatMessage } from '@goodboy/types';
import { EFFORT_LABEL } from '../chat/utils/chat-constants';
import { chatModelLabel } from './chatModelLabel';

type Params = {
  readonly message: Pick<ChatMessage, 'provider' | 'model' | 'effort'>;
};

export const chatAnswerMeta = ({ message }: Params): string | null => {
  if (message.provider === null || message.model === null) {
    return null;
  }
  const label = chatModelLabel({ provider: message.provider, model: message.model });
  return message.effort === null ? label : `${label} · ${EFFORT_LABEL[message.effort]}`;
};
