import type {
  Chat,
  EffortLevel,
  ProviderId,
  ChatId,
  ChatMessage,
  ChatMessageId,
  ChatSessionLink,
  ChatSessionLinkId,
  IsoDateTime,
} from '@goodboy/types';
import type { ChatSeed, ChatSeedParams } from './createMemoryChatBackend';
import { MOCK_ARCHIVED_CHATS } from './mockArchivedChats';
import { MOCK_CHAT_ANSWERS } from './mockChatAnswers';
import { mockChatSessionId, type MockChatSessionKey } from './mockChatSessions';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type FollowUp = {
  readonly question: string;
  readonly answer: string;
  readonly reads: ReadonlyArray<string>;
};

type Routing = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
};

const DEFAULT_ROUTING: Routing = { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' };

type SeedChat = {
  readonly key: string;
  readonly routing?: Routing;
  readonly title: string;
  readonly ageMs: number;
  readonly isPinned: boolean;
  readonly linkedSession?: MockChatSessionKey;
  readonly followUp?: FollowUp;
};

const SEED_CHATS: ReadonlyArray<SeedChat> = [
  {
    key: 'release',
    title: 'Release checklist for payments-api',
    ageMs: 5 * DAY_MS,
    isPinned: true,
    routing: { provider: 'anthropic', model: 'sonnet-5.5', effort: 'medium' },
  },
  {
    key: 'consent',
    title: 'Where is the consent step defined?',
    ageMs: 2 * HOUR_MS,
    isPinned: false,
    routing: { provider: 'anthropic', model: 'sonnet-5.5', effort: 'medium' },
    linkedSession: 'consent',
  },
  {
    key: 'retry',
    title: 'Why does notify-relay retry twice?',
    ageMs: 5 * HOUR_MS,
    isPinned: false,
    routing: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
  },
  {
    key: 'changes',
    title: 'What changed in payments-api this week',
    ageMs: 3 * DAY_MS,
    isPinned: false,
    followUp: {
      question: 'Which of those touched the refund path?',
      answer:
        'Two of them. The refund amount now rounds half up in ledger-core, and the refund webhook in notify-relay carries the rounded amount instead of the raw one.',
      reads: ['ledger-core/src/refunds/round.ts', 'notify-relay/src/webhooks/refund.ts'],
    },
  },
  {
    key: 'rounding',
    title: 'Ledger rounding on refunds',
    ageMs: 4 * DAY_MS,
    isPinned: false,
    routing: { provider: 'anthropic', model: 'opus-5.5', effort: 'high' },
    linkedSession: 'rounding',
  },
  {
    key: 'lunch',
    title: 'Lunch ideas near the office',
    ageMs: 9 * DAY_MS,
    isPinned: false,
    routing: { provider: 'anthropic', model: 'sonnet-5', effort: 'low' },
  },
  { key: 'webhook', title: 'Rename the webhook table?', ageMs: 14 * DAY_MS, isPinned: false },
  {
    key: 'flaky',
    title: 'Flaky test in ledger-core',
    ageMs: 21 * DAY_MS,
    isPinned: false,
    routing: { provider: 'anthropic', model: 'sonnet-5.5', effort: 'low' },
  },
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
  const links: ChatSessionLink[] = [];
  for (const seed of SEED_CHATS) {
    const answer = MOCK_CHAT_ANSWERS.find((candidate) => candidate.key === seed.key);
    if (answer === undefined) {
      continue;
    }
    const chatId = `mock-chat-${workspaceId}-${seed.key}` as ChatId;
    const askedAt = isoAt({ ms: now - seed.ageMs - 60_000 });
    const answeredAt = isoAt({ ms: now - seed.ageMs });
    const routing = seed.routing ?? DEFAULT_ROUTING;
    chats.push({
      id: chatId,
      workspaceId,
      title: seed.title,
      provider: seed.followUp === undefined ? routing.provider : 'codex',
      model: seed.followUp === undefined ? routing.model : 'gpt-5.6-sol',
      effort: seed.followUp === undefined ? routing.effort : 'high',
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
        attachments: [],
        error: null,
        provider: null,
        model: null,
        effort: null,
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
        attachments: [],
        error: null,
        provider: routing.provider,
        model: routing.model,
        effort: routing.effort,
        createdAt: answeredAt,
        updatedAt: answeredAt,
      },
    );
    if (seed.followUp !== undefined) {
      const followedAt = isoAt({ ms: now - seed.ageMs + 2 * 60_000 });
      const repliedAt = isoAt({ ms: now - seed.ageMs + 3 * 60_000 });
      messages.push(
        {
          id: `${chatId}-follow-up-question` as ChatMessageId,
          chatId,
          role: 'user',
          content: seed.followUp.question,
          status: 'done',
          reads: [],
          attachments: [],
          error: null,
          provider: null,
          model: null,
          effort: null,
          createdAt: followedAt,
          updatedAt: followedAt,
        },
        {
          id: `${chatId}-follow-up-answer` as ChatMessageId,
          chatId,
          role: 'assistant',
          content: seed.followUp.answer,
          status: 'done',
          reads: seed.followUp.reads,
          attachments: [],
          error: null,
          provider: 'codex',
          model: 'gpt-5.6-sol',
          effort: 'high',
          createdAt: repliedAt,
          updatedAt: repliedAt,
        },
      );
    }
    if (seed.linkedSession !== undefined) {
      links.push({
        id: `${chatId}-link` as ChatSessionLinkId,
        chatId,
        sessionId: mockChatSessionId({ workspaceId, key: seed.linkedSession }),
        messageId: `${chatId}-answer` as ChatMessageId,
        kind: 'new',
        createdAt: answeredAt,
      });
    }
  }
  for (const archived of MOCK_ARCHIVED_CHATS) {
    const chatId = `mock-chat-${workspaceId}-${archived.key}` as ChatId;
    const askedAt = isoAt({ ms: now - archived.ageMs - 60_000 });
    const answeredAt = isoAt({ ms: now - archived.ageMs });
    chats.push({
      id: chatId,
      workspaceId,
      title: archived.title,
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: null,
      pinnedAt: null,
      archivedAt: isoAt({ ms: now - archived.archivedAgoMs }),
      lastActivityAt: answeredAt,
      createdAt: askedAt,
      updatedAt: isoAt({ ms: now - archived.archivedAgoMs }),
    });
    messages.push(
      {
        id: `${chatId}-question` as ChatMessageId,
        chatId,
        role: 'user',
        content: archived.question,
        status: 'done',
        reads: [],
        attachments: [],
        error: null,
        provider: null,
        model: null,
        effort: null,
        createdAt: askedAt,
        updatedAt: askedAt,
      },
      {
        id: `${chatId}-answer` as ChatMessageId,
        chatId,
        role: 'assistant',
        content: archived.answer,
        status: 'done',
        reads: [],
        attachments: [],
        error: null,
        provider: 'anthropic',
        model: 'sonnet-5',
        effort: 'medium',
        createdAt: answeredAt,
        updatedAt: answeredAt,
      },
    );
  }
  return { chats, messages, links };
};
