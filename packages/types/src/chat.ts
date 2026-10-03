import type {
  ChatId,
  ChatMessageId,
  ChatSessionLinkId,
  IsoDateTime,
  SessionId,
  WorkspaceId,
} from './ids';
import type { EffortLevel, ProviderId } from './provider-registry';

export const CHAT_MESSAGE_ROLES = ['user', 'assistant'] as const;

export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const CHAT_MESSAGE_STATUSES = ['streaming', 'done', 'failed', 'stopped'] as const;

export type ChatMessageStatus = (typeof CHAT_MESSAGE_STATUSES)[number];

export const CHAT_PROVIDER_IDS = [
  'anthropic',
  'codex',
] as const satisfies ReadonlyArray<ProviderId>;

export type ChatProviderId = (typeof CHAT_PROVIDER_IDS)[number];

export const CHAT_PROVIDER_REFUSAL =
  'Chat needs a provider that can run read-only: Claude or Codex';

export const isChatProvider = (provider: ProviderId): provider is ChatProviderId =>
  CHAT_PROVIDER_IDS.some((candidate) => candidate === provider);

export const CHAT_IDLE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type Chat = Readonly<{
  id: ChatId;
  workspaceId: WorkspaceId;
  title: string;
  provider: ProviderId;
  model: string;
  effort: EffortLevel | null;
  pinnedAt: IsoDateTime | null;
  archivedAt: IsoDateTime | null;
  lastActivityAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type ChatModelUsed = Readonly<{
  provider: ProviderId;
  model: string;
}>;

export type ChatSummary = Chat &
  Readonly<{
    preview: string | null;
    modelsUsed: ReadonlyArray<ChatModelUsed>;
    messageCount: number;
  }>;

export type ChatMessage = Readonly<{
  id: ChatMessageId;
  chatId: ChatId;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  reads: ReadonlyArray<string>;
  error: string | null;
  provider: ProviderId | null;
  model: string | null;
  effort: EffortLevel | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export const CHAT_SESSION_LINK_KINDS = ['new', 'add'] as const;

export type ChatSessionLinkKind = (typeof CHAT_SESSION_LINK_KINDS)[number];

export type ChatSessionLink = Readonly<{
  id: ChatSessionLinkId;
  chatId: ChatId;
  sessionId: SessionId;
  messageId: ChatMessageId | null;
  kind: ChatSessionLinkKind;
  createdAt: IsoDateTime;
}>;
