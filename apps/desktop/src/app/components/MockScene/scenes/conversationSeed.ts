import type {
  ConversationMessage,
  ConversationSource,
  ConversationThread,
} from '../../../../shared/components/Conversation/types';

const MINUTE = 60_000;

const ago = (minutes: number): string => new Date(Date.now() - minutes * MINUTE).toISOString();

type MessageParams = {
  readonly id: string;
  readonly name: string;
  readonly minutes: number;
  readonly body: string;
  readonly handle?: string;
};

const message = ({ id, name, minutes, body, handle }: MessageParams): ConversationMessage => ({
  id,
  author: { name, avatarUrl: null, handle: handle ?? null },
  createdAt: ago(minutes),
  body,
  status: 'sent',
});

const MR_THREADS: ReadonlyArray<ConversationThread> = [
  {
    id: 'mr-1',
    head: message({
      id: 'mr-1a',
      name: 'Robin Vale',
      minutes: 30,
      body: '500 feels high for the nightly job. Can we read it from config?',
    }),
    replies: [
      message({
        id: 'mr-1b',
        name: 'Sam Kerr',
        minutes: 12,
        body: 'Moved to `SETTLE_BATCH_SIZE`, default 200.',
      }),
    ],
    anchor: 'settle/batch.ts:48',
    isResolved: false,
  },
  {
    id: 'mr-2',
    head: message({
      id: 'mr-2a',
      name: 'Priya Moss',
      minutes: 8,
      body: 'Can we get a test for the rollback path before merging?',
    }),
    replies: [1, 2, 3, 4, 5].map((index) =>
      message({
        id: `mr-2r${index}`,
        name: index % 2 === 0 ? 'Priya Moss' : 'Sam Kerr',
        minutes: 8 - index,
        body: `Follow-up ${index} on the rollback test.`,
      }),
    ),
    anchor: null,
    isResolved: false,
  },
  {
    id: 'mr-3',
    head: message({ id: 'mr-3a', name: 'Robin Vale', minutes: 90, body: 'Rename the flag.' }),
    replies: [message({ id: 'mr-3b', name: 'Sam Kerr', minutes: 80, body: 'Done.' })],
    anchor: 'settle/flags.ts:12',
    isResolved: true,
  },
];

const FLAT_THREADS: ReadonlyArray<ConversationThread> = [
  {
    id: 'gh-1',
    head: message({
      id: 'gh-1',
      name: 'leo-t',
      handle: 'leo-t',
      minutes: 1440,
      body: 'The table asks for all 40k sessions on mount. Paging at 100 fixes it locally.',
    }),
    replies: [],
    anchor: null,
    isResolved: null,
  },
  {
    id: 'gh-2',
    head: message({
      id: 'gh-2',
      name: 'ana-r',
      handle: 'ana-r',
      minutes: 1200,
      body: 'Paging breaks the export button, it reads the loaded rows.',
    }),
    replies: [],
    anchor: null,
    isResolved: null,
  },
  {
    id: 'gh-3',
    head: message({
      id: 'gh-3',
      name: 'ana-r',
      handle: 'ana-r',
      minutes: 1198,
      body: 'Export should ask the API, not the table.',
    }),
    replies: [],
    anchor: null,
    isResolved: null,
  },
];

const BASE = {
  isLoading: false,
  error: null,
  onRetry: () => undefined,
  onPost: () => new Promise<void>(() => undefined),
  onResolve: () => Promise.resolve(),
  resolveError: null,
  footnote: null,
  composerNote: null,
  renderMessageFooter: null,
} satisfies Partial<ConversationSource>;

export const MR_SOURCE: ConversationSource = {
  ...BASE,
  toolLabel: 'GitLab',
  threads: MR_THREADS,
  capabilities: { reply: 'thread', startThread: true, resolve: true, react: false },
  emptyDescription: 'Notes and review threads on this merge request show up here.',
  footnote: '2 system events hidden',
};

export const FLAT_SOURCE: ConversationSource = {
  ...BASE,
  toolLabel: 'GitHub issues',
  threads: FLAT_THREADS,
  capabilities: { reply: 'quote', startThread: true, resolve: false, react: false },
  onResolve: null,
  emptyDescription: 'This issue has no comments yet.',
};

export const READ_ONLY_SOURCE: ConversationSource = {
  ...FLAT_SOURCE,
  toolLabel: 'Northwind',
  onPost: null,
};
