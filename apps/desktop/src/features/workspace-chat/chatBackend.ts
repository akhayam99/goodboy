import type {
  Chat,
  ChatId,
  ChatMessage,
  ChatSessionLink,
  ChatSummary,
  EffortLevel,
  IsoDateTime,
  ModelKey,
  ProviderId,
  ProviderRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { ChatTurnOutcome, RunChatTurnParams } from './runChatTurn';

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

type ChatMessageParams = {
  readonly message: ChatMessage;
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

type CancelTurnParams = {
  readonly runId: ProviderRunId;
};

export type SummarizeForWorkParams = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly effort?: EffortLevel;
  readonly systemPrompt: string;
  readonly userMessage: string;
};

export type ChatBackend = {
  readonly listChats: (params: ListChatsParams) => Promise<ReadonlyArray<ChatSummary>>;
  readonly listMessages: (params: ChatRefParams) => Promise<ReadonlyArray<ChatMessage>>;
  readonly insertChat: (params: InsertChatParams) => Promise<void>;
  readonly insertMessage: (params: ChatMessageParams) => Promise<void>;
  readonly finishMessage: (params: ChatMessageParams) => Promise<void>;
  readonly setArchived: (params: SetArchivedParams) => Promise<void>;
  readonly deleteChats: (params: DeleteChatsParams) => Promise<void>;
  readonly insertLink: (params: InsertLinkParams) => Promise<void>;
  readonly listLinks: (params: ListLinksParams) => Promise<ReadonlyArray<ChatSessionLink>>;
  readonly setPinned: (params: SetPinnedParams) => Promise<void>;
  readonly rename: (params: RenameParams) => Promise<void>;
  readonly setModel: (params: SetModelParams) => Promise<void>;
  readonly settleStreaming: (params: SettleParams) => Promise<number>;
  readonly runTurn: (params: RunChatTurnParams) => Promise<ChatTurnOutcome>;
  readonly cancelTurn: (params: CancelTurnParams) => Promise<void>;
  readonly summarizeForWork: (params: SummarizeForWorkParams) => Promise<string>;
};
