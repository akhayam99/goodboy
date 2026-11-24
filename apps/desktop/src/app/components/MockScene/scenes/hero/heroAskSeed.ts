import {
  brandId,
  type AskThread,
  type ChatId,
  type ChatMessage,
  type ChatMessageId,
  type IsoDateTime,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AskHandle } from '../../../../../features/session/ask/askHandles';
import { buildAskPack } from '../../../../../features/session/ask/buildAskPack';
import { collectAskPackInput } from '../../../../../features/session/ask/collectAskPackInput';

const THREAD_ID = brandId<ChatId>({ value: 'mock-hero-ask-thread' });
const MINUTE = 60_000;

type Turn = Readonly<{
  question: string;
  answer: string;
  minutes: number;
  reads: ReadonlyArray<string>;
}>;

const TURNS: ReadonlyArray<Turn> = [
  {
    question: 'Can I merge #318 now?',
    answer:
      '**Yes. #318 is ready: all 8 checks passed and the review found nothing blocking.** It shares [[src/ledger/postCredit.ts:18]] with HBL-415, which has not pushed yet, so merge #318 first and that branch rebases onto it.',
    minutes: 6,
    reads: ['payments-api/src/ledger/postCredit.ts', 'payments-api/test/webhookReplay.test.ts'],
  },
  {
    question: 'What is left after that?',
    answer:
      '**Two things, and neither waits on you.** [[A1]] is firing 10,000 retries at the dedupe check on its own branch and has a few minutes left. Then #57 in notify-relay waits for one reviewer.',
    minutes: 3,
    reads: ['payments-api/test/dedupeLoad.test.ts'],
  },
  {
    question: 'Who should review #57?',
    answer:
      '**Acme QA.** They reviewed the last two changes to the deliveries screen in notify-relay, and nobody is assigned to #57 yet.',
    minutes: 1,
    reads: ['notify-relay/CODEOWNERS'],
  },
];

type AgoParams = {
  readonly minutes: number;
  readonly seconds?: number;
};

const isoAgo = ({ minutes, seconds = 0 }: AgoParams): IsoDateTime =>
  brandId<IsoDateTime>({
    value: new Date(Date.now() - minutes * MINUTE + seconds * 1000).toISOString(),
  });

type MessageParams = {
  readonly id: string;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly minutes: number;
  readonly reads: ReadonlyArray<string>;
};

const message = ({ id, role, content, minutes, reads }: MessageParams): ChatMessage => ({
  id: brandId<ChatMessageId>({ value: id }),
  chatId: THREAD_ID,
  role,
  content,
  status: 'done',
  reads: role === 'assistant' ? reads : [],
  attachments: [],
  error: null,
  provider: role === 'assistant' ? 'anthropic' : null,
  model: role === 'assistant' ? 'claude-sonnet-5-5' : null,
  effort: role === 'assistant' ? 'low' : null,
  createdAt: isoAgo({ minutes }),
  updatedAt: isoAgo({ minutes, seconds: role === 'assistant' ? 7 : 0 }),
});

type SeedParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
};

export const seedHeroAsk = ({ sessionId, workspaceId }: SeedParams): void => {
  const store = useAppStore.getState();
  store.openAsk({ sessionId });
  const pack = buildAskPack(collectAskPackInput({ state: store, sessionId, rightNow: [] }));
  const messages = TURNS.flatMap((turn, index) => [
    message({
      id: `mock-hero-ask-q${index}`,
      role: 'user',
      content: turn.question,
      minutes: turn.minutes,
      reads: [],
    }),
    message({
      id: `mock-hero-ask-a${index}`,
      role: 'assistant',
      content: turn.answer,
      minutes: turn.minutes,
      reads: turn.reads,
    }),
  ]);
  const handles: Record<ChatMessageId, ReadonlyArray<AskHandle>> = Object.fromEntries(
    messages.filter((entry) => entry.role === 'assistant').map((entry) => [entry.id, pack.handles]),
  );
  const thread: AskThread = {
    id: THREAD_ID,
    workspaceId,
    sessionId,
    title: TURNS[0]?.question ?? '',
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: 'low',
    lastActivityAt: isoAgo({ minutes: 1 }),
    createdAt: isoAgo({ minutes: 6 }),
    messageCount: messages.length,
  };
  useAppStore.setState({
    askThreads: { [sessionId]: [thread] },
    askThreadId: { [sessionId]: THREAD_ID },
    askMessages: { [THREAD_ID]: messages },
    askHandles: handles,
    askReplyMeta: Object.fromEntries(
      messages
        .filter((entry) => entry.role === 'assistant')
        .map((entry) => [entry.id, { costUsd: 0.03 }]),
    ),
    askStreams: {},
  });
};
