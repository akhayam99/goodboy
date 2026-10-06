import type {
  AskThread,
  ChatId,
  ChatMessage,
  ChatMessageId,
  IsoDateTime,
  ProviderRunId,
  Session,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { AskHandle } from '../../../../features/session/ask/askHandles';
import { buildAskPack } from '../../../../features/session/ask/buildAskPack';
import { collectAskPackInput } from '../../../../features/session/ask/collectAskPackInput';
import { mockAskAnswer } from '../../../../features/session/ask/mockAskAnswer';
import { SESSION } from './activityRunSeed';

export const ASK_SCENE_STATES = [
  'closed',
  'rightnow',
  'streaming',
  'answer',
  'followup',
  'plan',
] as const;

export type AskSceneState = (typeof ASK_SCENE_STATES)[number];

const THREAD_ID = 'mock-ask-thread-webhooks' as ChatId;
const FIRST_QUESTION = 'What needs me?';
const FOLLOW_UP = 'Which comments are ready?';
const MINUTE = 60_000;

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

type MessageParams = {
  readonly id: string;
  readonly role: ChatMessage['role'];
  readonly content: string;
  readonly status: ChatMessage['status'];
  readonly minutes: number;
  readonly seconds?: number;
};

const message = ({
  id,
  role,
  content,
  status,
  minutes,
  seconds = 0,
}: MessageParams): ChatMessage => ({
  id: id as ChatMessageId,
  chatId: THREAD_ID,
  role,
  content,
  status,
  reads:
    role === 'assistant' && status === 'done'
      ? ['notify-relay/src/webhook.ts', 'notify-relay/src/queue.ts']
      : [],
  attachments: [],
  error: null,
  provider: role === 'assistant' ? 'anthropic' : null,
  model: role === 'assistant' ? 'claude-sonnet-5-5' : null,
  effort: role === 'assistant' ? 'low' : null,
  createdAt: isoAgo({ minutes }),
  updatedAt: new Date(
    Date.parse(isoAgo({ minutes })) + seconds * 1000,
  ).toISOString() as IsoDateTime,
});

const threadOf = (session: Session): AskThread => ({
  id: THREAD_ID,
  workspaceId: session.workspaceId,
  sessionId: session.id,
  title: FIRST_QUESTION,
  provider: 'anthropic',
  model: 'claude-sonnet-5-5',
  effort: 'low',
  lastActivityAt: isoAgo({ minutes: 2 }),
  createdAt: isoAgo({ minutes: 3 }),
  messageCount: 1,
});

type TurnParams = {
  readonly index: number;
  readonly question: string;
  readonly answer: string;
  readonly status: ChatMessage['status'];
  readonly minutes: number;
};

const turn = ({ index, question, answer, status, minutes }: TurnParams) => [
  message({ id: `mock-ask-q${index}`, role: 'user', content: question, status: 'done', minutes }),
  message({
    id: `mock-ask-a${index}`,
    role: 'assistant',
    content: answer,
    status,
    minutes,
    seconds: 6,
  }),
];

type SeedParams = {
  readonly state: AskSceneState;
  readonly session?: Session;
};

export const seedSessionAsk = ({ state, session = SESSION }: SeedParams): void => {
  useAppStore.setState({ navigate: useAppStore.getInitialState().navigate });
  const store = useAppStore.getState();
  if (state === 'closed') {
    useAppStore.setState({ askThreadId: { [session.id]: null }, drawer: null });
    return;
  }
  store.openAsk({ sessionId: session.id });
  if (state === 'rightnow') {
    useAppStore.setState({ askThreadId: { [session.id]: null } });
    return;
  }
  const pack = buildAskPack(
    collectAskPackInput({ state: store, sessionId: session.id, rightNow: [] }),
  );
  const first = mockAskAnswer({ question: FIRST_QUESTION, pack: pack.text });
  const second = mockAskAnswer({ question: FOLLOW_UP, pack: pack.text });
  const isStreaming = state === 'streaming';
  const messages = [
    ...turn({
      index: 1,
      question: FIRST_QUESTION,
      answer: isStreaming ? first.slice(0, Math.floor(first.length * 0.55)) : first,
      status: isStreaming ? 'streaming' : 'done',
      minutes: 3,
    }),
    ...(state === 'followup'
      ? turn({ index: 2, question: FOLLOW_UP, answer: second, status: 'done', minutes: 1 })
      : []),
  ];
  const handles: Record<ChatMessageId, ReadonlyArray<AskHandle>> = Object.fromEntries(
    messages.filter((entry) => entry.role === 'assistant').map((entry) => [entry.id, pack.handles]),
  );
  useAppStore.setState({
    askThreads: { [session.id]: [threadOf(session)] },
    askThreadId: { [session.id]: THREAD_ID },
    askMessages: { [THREAD_ID]: messages },
    askHandles: handles,
    askReplyMeta: {
      ['mock-ask-a1' as ChatMessageId]: { costUsd: 0.04 },
      ['mock-ask-a2' as ChatMessageId]: { costUsd: 0.03 },
    },
    askStreams: isStreaming
      ? {
          [THREAD_ID]: {
            runId: 'mock-ask-run' as ProviderRunId,
            messageId: 'mock-ask-a1' as ChatMessageId,
            isStopping: false,
          },
        }
      : {},
  });
};
