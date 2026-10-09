import type {
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSessionLink,
  ChatSummary,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';

type ChatStream = {
  readonly runId: ProviderRunId;
  readonly messageId: ChatMessageId;
  readonly isStopping: boolean;
};

export type PendingChatLink = {
  readonly chatId: ChatId;
  readonly messageId: ChatMessageId | null;
};

export type ChatsState = {
  readonly chatLoadErrors: Readonly<Record<WorkspaceId, string | null>>;
  readonly chatsByWorkspace: Readonly<Record<WorkspaceId, ReadonlyArray<ChatSummary>>>;
  readonly archivedChatsByWorkspace: Readonly<Record<WorkspaceId, ReadonlyArray<ChatSummary>>>;
  readonly chatLinks: Readonly<Record<ChatId, ReadonlyArray<ChatSessionLink>>>;
  readonly pendingChatLinks: Readonly<Record<SessionId, ReadonlyArray<PendingChatLink>>>;
  readonly chatMessages: Readonly<Record<ChatId, ReadonlyArray<ChatMessage>>>;
  readonly chatStreams: Readonly<Record<ChatId, ChatStream>>;
  readonly hasSettledChatStreams: boolean;
  readonly unreadChatIds: ReadonlyArray<ChatId>;
};

export const chatsInitialState: ChatsState = {
  chatLoadErrors: {},
  chatsByWorkspace: {},
  archivedChatsByWorkspace: {},
  chatLinks: {},
  pendingChatLinks: {},
  chatMessages: {},
  chatStreams: {},
  hasSettledChatStreams: false,
  unreadChatIds: [],
};
