import type {
  ConversationCapabilities,
  ConversationMessage,
  ConversationSource,
  ConversationThread,
} from '../types';

type MessageParams = {
  readonly id: string;
  readonly name: string;
  readonly body: string;
  readonly createdAt?: string;
  readonly handle?: string | null;
};

export const fixtureMessage = ({
  id,
  name,
  body,
  createdAt = '2026-09-20T10:00:00Z',
  handle = null,
}: MessageParams): ConversationMessage => ({
  id,
  author: { name, avatarUrl: null, handle },
  createdAt,
  body,
  status: 'sent',
});

type ThreadParams = {
  readonly head: ConversationMessage;
  readonly replies?: ReadonlyArray<ConversationMessage>;
  readonly anchor?: string | null;
  readonly isResolved?: boolean | null;
};

export const fixtureThread = ({
  head,
  replies = [],
  anchor = null,
  isResolved = null,
}: ThreadParams): ConversationThread => ({
  id: `thread-${head.id}`,
  head,
  replies,
  anchor,
  isResolved,
});

export const THREADED: ConversationCapabilities = {
  reply: 'thread',
  startThread: true,
  resolve: true,
  react: false,
};

type SourceParams = Partial<ConversationSource> & {
  readonly threads: ReadonlyArray<ConversationThread>;
};

export const fixtureSource = ({ threads, ...rest }: SourceParams): ConversationSource => ({
  toolLabel: 'Northwind',
  threads,
  capabilities: THREADED,
  isLoading: false,
  error: null,
  onRetry: () => undefined,
  onPost: null,
  onResolve: null,
  resolveError: null,
  emptyDescription: 'Comments show up here.',
  footnote: null,
  composerNote: null,
  renderMessageFooter: null,
  ...rest,
});
