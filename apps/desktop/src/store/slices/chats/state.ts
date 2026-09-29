import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSummary,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types';

export type ChatStream = {
  readonly runId: ProviderRunId;
  readonly messageId: ChatMessageId;
  readonly isStopping: boolean;
};

export type ChatsState = {
  readonly chatsByWorkspace: Readonly<Record<WorkspaceId, ReadonlyArray<ChatSummary>>>;
  readonly chatMessages: Readonly<Record<ChatId, ReadonlyArray<ChatMessage>>>;
  readonly chatStreams: Readonly<Record<ChatId, ChatStream>>;
  readonly hasSettledChatStreams: boolean;
  readonly unreadChatIds: ReadonlyArray<ChatId>;
};

export const chatsInitialState: ChatsState = {
  chatsByWorkspace: {},
  chatMessages: {},
  chatStreams: {},
  hasSettledChatStreams: false,
  unreadChatIds: [],
};
