import { useMemo } from 'react';
import type { ConversationSource } from '../../../../../../shared/components/Conversation/types';
import { GITLAB_MR_CAPABILITIES, gitlabMrConversation } from '../../../gitlabMrConversation';
import { systemNoteFootnote } from '../../../systemNoteFootnote';
import type { useGitlabMrDiscussions } from '../../../useGitlabMrDiscussions';

type Params = {
  readonly discussions: ReturnType<typeof useGitlabMrDiscussions>;
};

export const useMrConversationSource = ({ discussions }: Params): ConversationSource => {
  const {
    discussions: discussionList,
    isLoading: isDiscussionLoading,
    error: discussionError,
    reload: reloadDiscussions,
    post: postNote,
    reply: replyToDiscussion,
    resolve: resolveDiscussion,
    resolveError,
  } = discussions;
  return useMemo<ConversationSource>(() => {
    const conversation = gitlabMrConversation({ discussions: discussionList });
    return {
      toolLabel: 'GitLab',
      threads: conversation.threads,
      capabilities: GITLAB_MR_CAPABILITIES,
      isLoading: isDiscussionLoading,
      error: discussionError,
      onRetry: reloadDiscussions,
      onPost:
        postNote == null || replyToDiscussion == null
          ? null
          : ({ body, threadId }) =>
              threadId == null
                ? postNote({ body })
                : replyToDiscussion({ discussionId: threadId, body }),
      onResolve:
        resolveDiscussion == null
          ? null
          : ({ threadId, isResolved }) =>
              resolveDiscussion({ discussionId: threadId, resolved: isResolved }),
      resolveError:
        resolveError == null
          ? null
          : { threadId: resolveError.discussionId, message: resolveError.message },
      footnote: systemNoteFootnote({ count: conversation.systemNoteCount }),
      composerNote: null,
      renderMessageFooter: null,
    };
  }, [
    discussionList,
    isDiscussionLoading,
    discussionError,
    reloadDiscussions,
    postNote,
    replyToDiscussion,
    resolveDiscussion,
    resolveError,
  ]);
};
