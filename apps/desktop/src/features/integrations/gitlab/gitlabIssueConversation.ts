import type {
  ConversationCapabilities,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { GitlabIssueNote } from './client';

export const GITLAB_ISSUE_CAPABILITIES = {
  reply: 'quote',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type Params = {
  readonly notes: ReadonlyArray<GitlabIssueNote>;
};

type Result = {
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly systemNoteCount: number;
};

export const gitlabIssueConversation = ({ notes }: Params): Result => {
  const visible = notes.filter((note) => !note.system);
  return {
    systemNoteCount: notes.length - visible.length,
    threads: visible
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((note) => ({
        id: String(note.id),
        head: {
          id: String(note.id),
          author: {
            name: note.author?.name ?? 'Unknown',
            avatarUrl: note.author?.avatarUrl ?? null,
            handle: null,
          },
          createdAt: note.createdAt,
          body: note.body,
          status: 'sent',
        },
        replies: [],
        anchor: null,
        isResolved: null,
      })),
  };
};
