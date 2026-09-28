import type { Chat, ChatId, ChatMessage, ChatMessageId, IsoDateTime } from '@goodboy/types';
import type { ChatSeed, ChatSeedParams } from './createMemoryChatBackend';
import { MOCK_CHAT_ANSWERS } from './mockChatAnswers';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type SeedChat = {
  readonly key: string;
  readonly title: string;
  readonly ageMs: number;
  readonly isPinned: boolean;
};

const SEED_CHATS: ReadonlyArray<SeedChat> = [
  {
    key: 'release',
    title: 'Release checklist for payments-api',
    ageMs: 5 * DAY_MS,
    isPinned: true,
  },
  {
    key: 'consent',
    title: 'Where is the consent step defined?',
    ageMs: 2 * HOUR_MS,
    isPinned: false,
  },
  {
    key: 'retry',
    title: 'Why does notify-relay retry twice?',
    ageMs: 5 * HOUR_MS,
    isPinned: false,
  },
  {
    key: 'changes',
    title: 'What changed in payments-api this week',
    ageMs: 3 * DAY_MS,
    isPinned: false,
  },
  { key: 'rounding', title: 'Ledger rounding on refunds', ageMs: 4 * DAY_MS, isPinned: false },
  { key: 'lunch', title: 'Lunch ideas near the office', ageMs: 9 * DAY_MS, isPinned: false },
  { key: 'webhook', title: 'Rename the webhook table?', ageMs: 14 * DAY_MS, isPinned: false },
  { key: 'flaky', title: 'Flaky test in ledger-core', ageMs: 21 * DAY_MS, isPinned: false },
];

type Params = ChatSeedParams & {
  readonly now?: number;
};

type MsParams = {
  readonly ms: number;
};

const isoAt = ({ ms }: MsParams): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

export const mockChatSeed = ({ workspaceId, now = Date.now() }: Params): ChatSeed => {
  const chats: Chat[] = [];
  const messages: ChatMessage[] = [];
  for (const seed of SEED_CHATS) {
    const answer = MOCK_CHAT_ANSWERS.find((candidate) => candidate.key === seed.key);
    if (answer === undefined) {
      continue;
    }
    const chatId = `mock-chat-${workspaceId}-${seed.key}` as ChatId;
    const askedAt = isoAt({ ms: now - seed.ageMs - 60_000 });
    const answeredAt = isoAt({ ms: now - seed.ageMs });
    chats.push({
      id: chatId,
      workspaceId,
      title: seed.title,
      provider: 'anthropic',
      model: 'sonnet-5',
      pinnedAt: seed.isPinned ? askedAt : null,
      archivedAt: null,
      lastActivityAt: answeredAt,
      createdAt: askedAt,
      updatedAt: answeredAt,
    });
    messages.push(
      {
        id: `${chatId}-question` as ChatMessageId,
        chatId,
        role: 'user',
        content: answer.question,
        status: 'done',
        reads: [],
        error: null,
        createdAt: askedAt,
        updatedAt: askedAt,
      },
      {
        id: `${chatId}-answer` as ChatMessageId,
        chatId,
        role: 'assistant',
        content: answer.text,
        status: 'done',
        reads: answer.reads,
        error: null,
        createdAt: answeredAt,
        updatedAt: answeredAt,
      },
    );
  }
  return { chats, messages };
};
