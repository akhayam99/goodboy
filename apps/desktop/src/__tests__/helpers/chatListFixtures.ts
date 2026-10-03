import type {
  Chat,
  ChatId,
  ChatMessage,
  ChatMessageId,
  EffortLevel,
  IsoDateTime,
  ProviderId,
  WorkspaceId,
} from '@goodboy/types';
import type { ChatBackend } from '../../features/workspace-chat/chatBackend';
import { createMemoryChatBackend } from '../../features/workspace-chat/createMemoryChatBackend';

export const CHAT_WORKSPACE_ID = 'ws-harborline' as WorkspaceId;

const HOUR = 60 * 60 * 1000;

export const CHAT_DAY = 24 * HOUR;

type ModelSeed = {
  readonly provider: ProviderId;
  readonly model: string;
};

export type ChatSeed = {
  readonly key: string;
  readonly title: string;
  readonly ageMs: number;
  readonly isPinned?: boolean;
  readonly isArchived?: boolean;
  readonly provider?: ProviderId;
  readonly model?: string;
  readonly effort?: EffortLevel | null;
  readonly used?: ReadonlyArray<ModelSeed>;
};

export const chatIdOf = ({ key }: { readonly key: string }): ChatId => `chat-${key}` as ChatId;

export const newChatBackend = (): ChatBackend =>
  createMemoryChatBackend({ respond: async () => ({ status: 'done' }) });

type SeedParams = {
  readonly backend: ChatBackend;
  readonly seeds: ReadonlyArray<ChatSeed>;
  readonly now?: number;
};

const iso = ({ ms }: { readonly ms: number }): IsoDateTime =>
  new Date(ms).toISOString() as IsoDateTime;

export const seedChats = async ({
  backend,
  seeds,
  now = Date.now(),
}: SeedParams): Promise<void> => {
  for (const seed of seeds) {
    const provider = seed.provider ?? 'anthropic';
    const model = seed.model ?? 'sonnet-5';
    const effort = seed.effort === undefined ? 'medium' : seed.effort;
    const at = iso({ ms: now - seed.ageMs });
    const chatId = chatIdOf({ key: seed.key });
    const chat: Chat = {
      id: chatId,
      workspaceId: CHAT_WORKSPACE_ID,
      title: seed.title,
      provider,
      model,
      effort,
      pinnedAt: seed.isPinned === true ? at : null,
      archivedAt: seed.isArchived === true ? at : null,
      lastActivityAt: at,
      createdAt: at,
      updatedAt: at,
    };
    await backend.insertChat({ chat });
    const used = seed.used ?? [{ provider, model }];
    for (const [index, entry] of used.entries()) {
      const base = {
        chatId,
        reads: [],
        attachments: [],
        error: null,
        createdAt: at,
        updatedAt: at,
      };
      const question: ChatMessage = {
        ...base,
        id: `${chatId}-q${index}` as ChatMessageId,
        role: 'user',
        content: `Question ${index + 1} about ${seed.title}`,
        status: 'done',
        provider: null,
        model: null,
        effort: null,
      };
      const answer: ChatMessage = {
        ...base,
        id: `${chatId}-a${index}` as ChatMessageId,
        role: 'assistant',
        content: `**Answer for ${seed.title}**`,
        status: 'done',
        provider: entry.provider,
        model: entry.model,
        effort,
      };
      await backend.insertMessage({ message: question });
      await backend.insertMessage({ message: answer });
    }
  }
};
