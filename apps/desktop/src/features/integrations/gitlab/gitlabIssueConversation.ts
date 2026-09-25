import type {
  ConversationCapabilities,
  ConversationThread,
} from '../../../shared/components/Conversation/types';
import type { GitlabMrDiscussion } from './client';
import { gitlabMrConversation } from './gitlabMrConversation';

export const GITLAB_ISSUE_CAPABILITIES = {
  reply: 'thread',
  startThread: true,
  resolve: false,
  react: false,
} satisfies ConversationCapabilities;

type Params = {
  readonly discussions: ReadonlyArray<GitlabMrDiscussion>;
};

type Result = {
  readonly threads: ReadonlyArray<ConversationThread>;
  readonly systemNoteCount: number;
};

export const gitlabIssueConversation = ({ discussions }: Params): Result =>
  gitlabMrConversation({ discussions });
