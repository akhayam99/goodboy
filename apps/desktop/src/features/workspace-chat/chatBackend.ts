import type {
  Chat,
  ChatId,
  ChatMessage,
  ChatSummary,
  IsoDateTime,
  ModelKey,
  ProviderId,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { ChatTurnOutcome, RunChatTurnParams } from './runChatTurn';

export type ListChatsParams = {
  readonly workspaceId: WorkspaceId;
  readonly includeArchived?: boolean;
};

export type ChatRefParams = {
  readonly chatId: ChatId;
};

export type InsertChatParams = {
  readonly chat: Chat;
};

export type ChatMessageParams = {
  readonly message: ChatMessage;
};

export type SetArchivedParams = {
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly archivedAt: IsoDateTime | null;
  readonly now: IsoDateTime;
};

export type SetPinnedParams = ChatRefParams & {
  readonly pinnedAt: IsoDateTime | null;
  readonly now: IsoDateTime;
};

export type RenameParams = ChatRefParams & {
  readonly title: string;
  readonly now: IsoDateTime;
};

export type SetModelParams = ChatRefParams & {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly now: IsoDateTime;
};

export type SettleParams = {
  readonly now: IsoDateTime;
};

export type CancelTurnParams = {
  readonly runId: ProviderRunId;
};

export type ChatBackend = {
  readonly listChats: (params: ListChatsParams) => Promise<ReadonlyArray<ChatSummary>>;
  readonly listMessages: (params: ChatRefParams) => Promise<ReadonlyArray<ChatMessage>>;
  readonly insertChat: (params: InsertChatParams) => Promise<void>;
  readonly insertMessage: (params: ChatMessageParams) => Promise<void>;
  readonly finishMessage: (params: ChatMessageParams) => Promise<void>;
  readonly setArchived: (params: SetArchivedParams) => Promise<void>;
  readonly setPinned: (params: SetPinnedParams) => Promise<void>;
  readonly rename: (params: RenameParams) => Promise<void>;
  readonly setModel: (params: SetModelParams) => Promise<void>;
  readonly settleStreaming: (params: SettleParams) => Promise<number>;
  readonly runTurn: (params: RunChatTurnParams) => Promise<ChatTurnOutcome>;
  readonly cancelTurn: (params: CancelTurnParams) => Promise<void>;
};
