import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSessionLink,
  ChatSummary,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types';

type ChatStream = {
  readonly runId: ProviderRunId;
  readonly messageId: ChatMessageId;
  readonly isStopping: boolean;
};

export type ChatsState = {
  readonly chatsByWorkspace: Readonly<Record<WorkspaceId, ReadonlyArray<ChatSummary>>>;
  readonly archivedChatsByWorkspace: Readonly<Record<WorkspaceId, ReadonlyArray<ChatSummary>>>;
  readonly chatLinks: Readonly<Record<ChatId, ReadonlyArray<ChatSessionLink>>>;
  readonly chatMessages: Readonly<Record<ChatId, ReadonlyArray<ChatMessage>>>;
  readonly chatStreams: Readonly<Record<ChatId, ChatStream>>;
  readonly hasSettledChatStreams: boolean;
  readonly unreadChatIds: ReadonlyArray<ChatId>;
};

export const chatsInitialState: ChatsState = {
  chatsByWorkspace: {},
  archivedChatsByWorkspace: {},
  chatLinks: {},
  chatMessages: {},
  chatStreams: {},
  hasSettledChatStreams: false,
  unreadChatIds: [],
};
