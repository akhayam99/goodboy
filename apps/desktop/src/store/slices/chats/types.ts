import type {
  ChatId,
  ChatMessageId,
  ChatSessionLink,
  ChatSessionLinkKind,
  ChatSummary,
  EffortLevel,
  ModelKey,
  ProviderId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import type { ChatsState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type LoadChatsParams = {
  readonly workspaceId: WorkspaceId;
};

export type ChatParams = {
  readonly chatId: ChatId;
};

export type RecordChatLinkParams = ChatParams & {
  readonly sessionId: SessionId;
  readonly messageId: ChatMessageId | null;
  readonly kind: ChatSessionLinkKind;
};

export type CreateChatParams = {
  readonly workspaceId: WorkspaceId;
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly title?: string;
};

export type SendChatMessageParams = ChatParams & {
  readonly content: string;
};

export type ArchiveChatsParams = {
  readonly workspaceId: WorkspaceId;
  readonly chatIds: ReadonlyArray<ChatId>;
};

export type ArchiveIdleChatsParams = {
  readonly workspaceId: WorkspaceId;
};

export type PinChatParams = ChatParams & {
  readonly isPinned: boolean;
};

export type RenameChatParams = ChatParams & {
  readonly title: string;
};

export type SetChatModelParams = ChatParams & {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly effort?: EffortLevel | null;
};

export type ChatsSlice = ChatsState & {
  loadChats(params: LoadChatsParams): Promise<void>;
  loadArchivedChats(params: LoadChatsParams): Promise<ReadonlyArray<ChatSummary>>;
  loadChatMessages(params: ChatParams): Promise<void>;
  createChat(params: CreateChatParams): Promise<ChatId>;
  sendChatMessage(params: SendChatMessageParams): Promise<void>;
  stopChatReply(params: ChatParams): Promise<void>;
  archiveChats(params: ArchiveChatsParams): Promise<void>;
  archiveIdleChats(params: ArchiveIdleChatsParams): Promise<ReadonlyArray<ChatId>>;
  restoreChats(params: ArchiveChatsParams): Promise<void>;
  deleteChats(params: ArchiveChatsParams): Promise<void>;
  recordChatLink(params: RecordChatLinkParams): Promise<ChatSessionLink>;
  pinChat(params: PinChatParams): Promise<void>;
  renameChat(params: RenameChatParams): Promise<void>;
  setChatModel(params: SetChatModelParams): Promise<void>;
  markChatRead(params: ChatParams): void;
  markChatUnread(params: ChatParams): void;
};
