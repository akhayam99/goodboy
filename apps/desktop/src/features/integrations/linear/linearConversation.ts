import type {
  ConversationCapabilities,
  ConversationMessage,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { LinearIssueComment } from './client';
import { linearThreads } from './linearThreads';

export const LINEAR_CAPABILITIES = {
  reply: 'thread',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type CommentParams = {
  readonly comment: LinearIssueComment;
};

const messageOf = ({ comment }: CommentParams): ConversationMessage => ({
  id: comment.id,
  author: {
    name: comment.user?.name ?? 'Unknown author',
    avatarUrl: comment.user?.avatarUrl ?? null,
    handle: null,
  },
  createdAt: comment.createdAt,
  body: comment.body,
  status: 'sent',
});

type Params = {
  readonly comments: ReadonlyArray<LinearIssueComment>;
};

export const linearConversation = ({ comments }: Params): ReadonlyArray<ConversationThread> =>
  linearThreads({ comments }).map((thread) => ({
    id: thread.head.id,
    head: messageOf({ comment: thread.head }),
    replies: thread.replies.map((comment) => messageOf({ comment })),
    anchor: null,
    isResolved: null,
  }));
