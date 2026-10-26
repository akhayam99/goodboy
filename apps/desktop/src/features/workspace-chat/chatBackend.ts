import type {
  Chat,
  ChatAttachmentId,
  ChatId,
  ChatMessage,
  ChatSessionLink,
  ChatSummary,
  EffortLevel,
  IsoDateTime,
  ModelKey,
  ProviderId,
  WorkspaceId,
} from '@goodboy/types';
import type { ChatTurnOutcome } from '../conversation/chatTurnOutcome';
import type { ConversationBackend } from '../conversation/conversationBackend';
import type { RunChatTurnParams } from './runChatTurn';

type ListChatsParams = {
  readonly workspaceId: WorkspaceId;
  readonly includeArchived?: boolean;
};

type ChatRefParams = {
  readonly chatId: ChatId;
};

type InsertChatParams = {
  readonly chat: Chat;
};

type SetArchivedParams = {
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly archivedAt: IsoDateTime | null;
  readonly now: IsoDateTime;
};

type DeleteChatsParams = {
  readonly chatIds: ReadonlyArray<ChatId>;
};

type InsertLinkParams = {
  readonly link: ChatSessionLink;
};

type ListLinksParams = {
  readonly workspaceId: WorkspaceId;
};

type SetPinnedParams = ChatRefParams & {
  readonly pinnedAt: IsoDateTime | null;
  readonly now: IsoDateTime;
};

type RenameParams = ChatRefParams & {
  readonly title: string;
  readonly now: IsoDateTime;
};

type SetModelParams = ChatRefParams & {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly effort: EffortLevel | null;
  readonly now: IsoDateTime;
};

type SettleParams = {
  readonly now: IsoDateTime;
};

type ChatImageRef = {
  readonly chatId: ChatId;
  readonly attachmentId: ChatAttachmentId;
};

type WriteChatImageParams = ChatImageRef & {
  readonly fileName: string;
  readonly blob: Blob;
};

export type SummarizeForWorkParams = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly effort?: EffortLevel;
  readonly systemPrompt: string;
  readonly userMessage: string;
};

export type ChatBackend = ConversationBackend & {
  readonly listChats: (params: ListChatsParams) => Promise<ReadonlyArray<ChatSummary>>;
  readonly listMessages: (params: ChatRefParams) => Promise<ReadonlyArray<ChatMessage>>;
  readonly insertChat: (params: InsertChatParams) => Promise<void>;
  readonly setArchived: (params: SetArchivedParams) => Promise<void>;
  readonly deleteChats: (params: DeleteChatsParams) => Promise<void>;
  readonly insertLink: (params: InsertLinkParams) => Promise<void>;
  readonly listLinks: (params: ListLinksParams) => Promise<ReadonlyArray<ChatSessionLink>>;
  readonly setPinned: (params: SetPinnedParams) => Promise<void>;
  readonly rename: (params: RenameParams) => Promise<void>;
  readonly setModel: (params: SetModelParams) => Promise<void>;
  readonly settleStreaming: (params: SettleParams) => Promise<number>;
  readonly writeImage: (params: WriteChatImageParams) => Promise<number>;
  readonly readImage: (params: ChatImageRef) => Promise<Blob>;
  readonly runTurn: (params: RunChatTurnParams) => Promise<ChatTurnOutcome>;
  readonly summarizeForWork: (params: SummarizeForWorkParams) => Promise<string>;
};
