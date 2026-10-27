import type { ChatMessage, ProviderRunId } from '@goodboy/types';

type MessageParams = {
  readonly message: ChatMessage;
};

type CancelParams = {
  readonly runId: ProviderRunId;
};

export type ConversationBackend = {
  readonly insertMessage: (params: MessageParams) => Promise<void>;
  readonly finishMessage: (params: MessageParams) => Promise<void>;
  readonly cancelTurn: (params: CancelParams) => Promise<void>;
};
