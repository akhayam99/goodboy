import { useState } from 'react';
import { Divider, Markdown } from '@goodboy/ui';
import { MessageSquareReply } from 'lucide-react';
import { IssueStateBadge } from '../../../../../shared/components/IssueStateBadge';
import { MrNoteComposer } from './MrNoteComposer';
import { MrNoteHeader } from './MrNoteHeader';
import { threadAnchor, type MrThread } from './mrThreads';

type Props = {
  readonly thread: MrThread;
  readonly onReply: ((body: string) => Promise<void>) | null;
};

export const MrThreadCard = ({ thread, onReply }: Props) => {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const anchor = threadAnchor(thread);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <MrNoteHeader note={thread.head} />
        {anchor != null && (
          <span className="truncate font-mono text-2xs text-muted-foreground">{anchor}</span>
        )}
        {thread.isResolved && <IssueStateBadge tone="success">resolved</IssueStateBadge>}
      </div>
      <Markdown text={thread.head.body} className="text-sm leading-relaxed" />

      {thread.replies.length > 0 && (
        <div className="flex gap-2 pl-1">
          <Divider orientation="vertical" />
          <ul className="flex min-w-0 flex-1 flex-col gap-2">
            {thread.replies.map((reply) => (
              <li key={reply.id} className="flex min-w-0 flex-col gap-1">
                <MrNoteHeader note={reply} />
                <Markdown text={reply.body} className="text-sm leading-relaxed" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {onReply != null && !isReplyOpen && (
        <button
          type="button"
          onClick={() => setIsReplyOpen(true)}
          className="inline-flex w-fit items-center gap-1 rounded-md text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <MessageSquareReply size={11} aria-hidden />
          Reply
        </button>
      )}
      {onReply != null && isReplyOpen && (
        <MrNoteComposer
          placeholder="Write a reply"
          submitLabel="Reply"
          minRows={2}
          onSubmit={async (body) => {
            await onReply(body);
            setIsReplyOpen(false);
          }}
        />
      )}
    </div>
  );
};
