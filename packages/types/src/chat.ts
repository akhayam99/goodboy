import type { ChatId, ChatMessageId, IsoDateTime, WorkspaceId } from './ids';
import type { ProviderId } from './provider-registry';

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
  pinnedAt: IsoDateTime | null;
  archivedAt: IsoDateTime | null;
  lastActivityAt: IsoDateTime;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type ChatSummary = Chat &
  Readonly<{
    preview: string | null;
  }>;

export type ChatMessage = Readonly<{
  id: ChatMessageId;
  chatId: ChatId;
  role: ChatMessageRole;
  content: string;
  status: ChatMessageStatus;
  reads: ReadonlyArray<string>;
  error: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;
