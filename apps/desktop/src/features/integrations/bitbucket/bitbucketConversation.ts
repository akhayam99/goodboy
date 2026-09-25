import type {
  ConversationCapabilities,
  ConversationMessage,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import { bitbucketPrThreads } from './BitbucketStudio/PrDetailPanel/bitbucketPrThreads';
import type { BitbucketComment } from './client';

export const BITBUCKET_PR_CAPABILITIES = {
  reply: 'thread',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type CommentParams = {
  readonly comment: BitbucketComment;
};

const messageOf = ({ comment }: CommentParams): ConversationMessage => ({
  id: String(comment.id),
  author: {
    name: comment.user?.displayName ?? 'Unknown',
    avatarUrl: comment.user?.avatarUrl ?? null,
    handle: null,
  },
  createdAt: comment.createdOn,
  body: comment.body,
  status: 'sent',
});

const anchorOf = ({ comment }: CommentParams): string | null => {
  const inline = comment.inline;
  if (inline == null) {
    return null;
  }
  return inline.to == null ? inline.path : `${inline.path}:${inline.to}`;
};

type Params = {
  readonly comments: ReadonlyArray<BitbucketComment>;
};

export const bitbucketConversation = ({ comments }: Params): ReadonlyArray<ConversationThread> =>
  bitbucketPrThreads({ comments })
    .map((thread) => ({
      id: String(thread.head.id),
      head: messageOf({ comment: thread.head }),
      replies: thread.replies.map((comment) => messageOf({ comment })),
      anchor: anchorOf({ comment: thread.head }),
      isResolved: null,
    }))
    .sort((left, right) => left.head.createdAt.localeCompare(right.head.createdAt));
