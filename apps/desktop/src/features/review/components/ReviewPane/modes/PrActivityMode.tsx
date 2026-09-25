import { useMemo } from 'react';
import { Button } from '@goodboy/ui';
import type { DiffComment, PrComment, PullRequestState } from '@goodboy/types';
import { PrConversation } from '../../../../github/components/PullRequest/PrConversation';
import type { CommentThread } from '../../../../github/comment-threads';
import { LocalNotesSection } from '../LocalNotesSection';

type Props = {
  readonly pr: PullRequestState;
  readonly comments: ReadonlyArray<PrComment>;
  readonly localNotes: ReadonlyArray<DiffComment>;
  readonly onOpenUrl: (url: string) => void;
  readonly onOpenConversations: () => void;
  readonly onOpenLocalNotes: () => void;
  readonly onFix: (thread: CommentThread) => void;
};

export const PrActivityMode = ({
  pr,
  comments,
  localNotes,
  onOpenUrl,
  onOpenConversations,
  onOpenLocalNotes,
  onFix,
}: Props) => {
  const general = useMemo(
    () => comments.filter((comment) => comment.source === 'issue'),
    [comments],
  );
  return (
    <section aria-label="PR activity" className="flex flex-col gap-6">
      <PrConversation
        comments={general}
        pr={pr}
        onOpenUrl={onOpenUrl}
        onFix={onFix}
        empty={{
          title: 'No general comments',
          description: 'Comments on the pull request itself show up here.',
          action: (
            <Button variant="ghost" size="sm" onClick={onOpenConversations}>
              Open conversations
            </Button>
          ),
        }}
      />
      <LocalNotesSection comments={localNotes} onOpen={onOpenLocalNotes} />
    </section>
  );
};
