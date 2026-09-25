import type { GithubIssueComment } from '@goodboy/types';
import type {
  ConversationCapabilities,
  ConversationThread,
} from '../../shared/components/Conversation/types';

export const GITHUB_ISSUE_CAPABILITIES = {
  reply: 'quote',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type Params = {
  readonly comments: ReadonlyArray<GithubIssueComment>;
};

export const githubIssueConversation = ({ comments }: Params): ReadonlyArray<ConversationThread> =>
  [...comments]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((comment) => ({
      id: comment.id,
      head: {
        id: comment.id,
        author: {
          name: comment.author,
          avatarUrl: comment.authorAvatarUrl,
          handle: comment.author,
        },
        createdAt: comment.createdAt,
        body: comment.body,
        status: 'sent',
      },
      replies: [],
      anchor: null,
      isResolved: null,
    }));
