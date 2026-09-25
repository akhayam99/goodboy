import type {
  ConversationCapabilities,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { LinearIssueComment } from './client';

export const LINEAR_CAPABILITIES = {
  reply: 'none',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type Params = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
};

export const linearConversation = ({ comments }: Params): ReadonlyArray<ConversationThread> =>
  comments.map((comment) => ({
    id: comment.id,
    head: {
      id: comment.id,
      author: { name: comment.user?.name ?? 'Unknown author', avatarUrl: null, handle: null },
      createdAt: comment.createdAt,
      body: comment.body,
      status: 'sent',
    },
    replies: [],
    anchor: null,
    isResolved: null,
  }));
