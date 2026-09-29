import type {
  Agent,
  AgentHandoff,
  AgentId,
  IsoDateTime,
  ProviderRunId,
  TurnEvent,
  TurnState,
} from '@goodboy/types';

const MINUTE = 60_000;
const LIVE_THREAD = 'PRRT_thread_retry_backoff';
const LIVE_ASK = 'Resolve the review comment on retryPolicy.ts:42, branch hl/fix-duplicate-credit.';

const isoAgo = ({ minutes }: { readonly minutes: number }): IsoDateTime =>
  new Date(Date.now() - minutes * MINUTE).toISOString() as IsoDateTime;

type LiveParams = {
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
};

export const liveAgent = ({ agent }: { readonly agent: Agent }): Agent => ({
  ...agent,
  status: 'running',
  completedAt: undefined,
});

export const liveTurnState = ({ runId }: { readonly runId: ProviderRunId }): TurnState => ({
  kind: 'running',
  runId,
  startedAt: isoAgo({ minutes: 0.6 }),
});

export const liveHandoff = ({ agentId }: { readonly agentId: AgentId }): AgentHandoff => ({
  agentId,
  sender: { kind: 'resolve', threadIds: [LIVE_THREAD], prNumber: 318 },
  ask: LIVE_ASK,
  why: null,
  doneWhen: null,
  sections: [
    { kind: 'ask', summary: LIVE_ASK, bodyMd: LIVE_ASK, refs: [] },
    {
      kind: 'threads',
      summary: '1 comment',
      bodyMd: '',
      refs: [
        {
          kind: 'thread',
          threadId: LIVE_THREAD,
          label: 'Stop retrying forever on a 429',
          author: 'Mara Quint',
          location: 'retryPolicy.ts:42',
          link: null,
        },
      ],
    },
    {
      kind: 'scope',
      summary: 'Writes payments-api',
      bodyMd: 'You may change payments-api. Leave every other project as it is.',
      refs: [],
    },
    {
      kind: 'profile',
      summary: 'About you',
      bodyMd: 'You resolve review comments with the smallest change that answers them.',
      refs: [],
    },
    {
      kind: 'role',
      summary: 'Resolver instructions',
      bodyMd: 'You are the resolver. Change only what the comment asks for, then reply.',
      refs: [],
    },
  ],
  sentSystem: null,
  sentMessage: LIVE_ASK,
  provider: 'anthropic',
  createdAt: isoAgo({ minutes: 0.6 }),
});

export const liveTranscript = ({ agentId, runId }: LiveParams): ReadonlyArray<TurnEvent> => [
  {
    kind: 'user_text',
    runId,
    text: LIVE_ASK,
    handoffId: agentId,
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    at: isoAgo({ minutes: 0.6 }),
  },
  {
    kind: 'assistant_text',
    runId,
    delta: 'Reading the retry loop and the comment.',
    at: isoAgo({ minutes: 0.5 }),
  },
  {
    kind: 'assistant_text',
    runId,
    delta: 'Capping the loop at five tries and adding jitter to every delay.',
    at: isoAgo({ minutes: 0.3 }),
  },
];
