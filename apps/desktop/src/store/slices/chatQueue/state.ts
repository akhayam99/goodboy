import type { ChatId } from '@goodboy/types';
import type { QueuedChatTurn } from './types';

export type ChatQueueState = {
  readonly chatQueues: Readonly<Record<ChatId, ReadonlyArray<QueuedChatTurn>>>;
};

export const chatQueueInitialState: ChatQueueState = {
  chatQueues: {},
};
