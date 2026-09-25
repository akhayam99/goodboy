import type {
  ConversationCapabilities,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { JiraComment } from './client';

export const JIRA_CAPABILITIES = {
  reply: 'quote',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type Params = {
  readonly comments: ReadonlyArray<JiraComment>;
};

type Result = {
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly footnote: string | null;
};

type FootnoteParams = {
  readonly count: number;
};

const unreadableFootnote = ({ count }: FootnoteParams): string | null => {
  if (count === 0) {
    return null;
  }
  return count === 1 ? '1 comment has no readable text' : `${count} comments have no readable text`;
};

export const jiraConversation = ({ comments }: Params): Result => {
  const visible = comments.filter((comment) => comment.body.trim() !== '');
  return {
    footnote: unreadableFootnote({ count: comments.length - visible.length }),
    threads: visible
      .sort((left, right) => left.created.localeCompare(right.created))
      .map((comment) => ({
        id: comment.id,
        head: {
          id: comment.id,
          author: {
            name: comment.author?.displayName ?? 'Unknown',
            avatarUrl: comment.author?.avatarUrls?.['24x24'] ?? null,
            handle: null,
          },
          createdAt: comment.created,
          body: comment.body,
          status: 'sent',
        },
        replies: [],
        anchor: null,
        isResolved: null,
      })),
  };
};
