import { useState } from 'react';
import { Divider, Markdown, NoteComposer } from '@goodboy/ui';
import { MessageSquareReply } from 'lucide-react';
import type { BitbucketPrThread } from './bitbucketPrThreads';
import { PrNoteHeader } from './PrNoteHeader';

type Props = {
  readonly thread: BitbucketPrThread;
  readonly onReply: ((body: string) => Promise<void>) | null;
};

export const PrThreadCard = ({ thread, onReply }: Props) => {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const inline = thread.head.inline;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-muted/20 p-3">
      <PrNoteHeader comment={thread.head} />
      {inline != null && (
        <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground/70">
          {inline.path}
          {inline.to != null ? `:${inline.to}` : ''}
        </span>
      )}
      <Markdown text={thread.head.body} className="text-sm leading-relaxed" />

      {thread.replies.length > 0 && (
        <div className="flex gap-2">
          <Divider orientation="vertical" />
          <ul className="flex min-w-0 flex-1 flex-col gap-2">
            {thread.replies.map((reply) => (
              <li key={reply.id} className="flex min-w-0 flex-col gap-1">
                <PrNoteHeader comment={reply} />
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
        <NoteComposer
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
