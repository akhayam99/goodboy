import { useState } from 'react';
import { FOCUS_RING, cn } from '@goodboy/ui';
import { isContinuation } from './isContinuation';
import { MessageRow } from './MessageRow';
import { ReplyElbow } from './ReplyElbow';
import { ResolvedThreadRow } from './ResolvedThreadRow';
import { messageActions, replyActionOf } from './messageActions';
import type { ConversationMessage, ConversationSource, ConversationThread } from './types';
import type { ConversationModel } from './useConversation';

const VISIBLE_REPLIES = 3;

type Props = {
  readonly thread: ConversationThread;
  readonly source: ConversationSource;
  readonly model: ConversationModel;
  readonly isHeadContinuation: boolean;
};

export const ThreadBlock = ({ thread, source, model, isHeadContinuation }: Props) => {
  const [isResolvedOpen, setIsResolvedOpen] = useState(false);
  const [isEarlierOpen, setIsEarlierOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const isTargeted = model.target != null && model.target.threadId === thread.id;
  const onResolveThread = source.onResolve;
  const resolveError =
    source.resolveError != null && source.resolveError.threadId === thread.id
      ? source.resolveError.message
      : null;

  const resolve =
    source.capabilities.resolve && onResolveThread != null && thread.isResolved != null
      ? () => {
          setIsResolving(true);
          void onResolveThread({ threadId: thread.id, isResolved: thread.isResolved !== true })
            .catch(() => undefined)
            .finally(() => setIsResolving(false));
        }
      : null;

  const hiddenCount = isEarlierOpen ? 0 : Math.max(0, thread.replies.length - VISIBLE_REPLIES);
  const visibleReplies = thread.replies.slice(hiddenCount);

  const renderMessage = (
    message: ConversationMessage,
    previous: ConversationMessage | null,
    isHead: boolean,
  ) => (
    <MessageRow
      message={message}
      isContinuation={isHead ? isHeadContinuation : isContinuation({ previous, message })}
      anchor={isHead ? thread.anchor : null}
      actions={messageActions({
        thread,
        message,
        isHead,
        source,
        model,
        isResolving,
        onResolve: resolve,
      })}
      footer={source.renderMessageFooter == null ? null : source.renderMessageFooter(message)}
      failure={model.failureOf(message.id)}
      onReplyKey={replyActionOf({ thread, message, source, model })}
    />
  );

  if (thread.isResolved === true && !isResolvedOpen) {
    return (
      <ResolvedThreadRow thread={thread} isOpen={false} onToggle={() => setIsResolvedOpen(true)} />
    );
  }

  return (
    <div
      data-thread-id={thread.id}
      data-targeted={isTargeted ? 'true' : undefined}
      className={cn('flex min-w-0 flex-col gap-1 rounded-md', isTargeted && 'bg-selected')}
    >
      {thread.isResolved === true ? (
        <ResolvedThreadRow thread={thread} isOpen onToggle={() => setIsResolvedOpen(false)} />
      ) : null}
      {renderMessage(thread.head, null, true)}
      {resolveError == null ? null : (
        <p role="alert" className="px-1.5 text-secondary text-danger">
          {resolveError}
        </p>
      )}
      {thread.replies.length === 0 ? null : (
        <ul aria-label="Replies" className="flex min-w-0 flex-col pl-8">
          {hiddenCount > 0 ? (
            <li className="relative flex min-w-0">
              <ReplyElbow isLast={false} />
              <button
                type="button"
                onClick={() => setIsEarlierOpen(true)}
                className={cn(
                  'h-7 rounded-md px-1.5 text-secondary font-medium text-muted-foreground hover:bg-hover hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                {hiddenCount === 1 ? 'Show 1 earlier reply' : `Show ${hiddenCount} earlier replies`}
              </button>
            </li>
          ) : null}
          {visibleReplies.map((reply, index) => (
            <li key={reply.id} className="relative min-w-0">
              <ReplyElbow isLast={index === visibleReplies.length - 1} />
              {renderMessage(
                reply,
                index === 0 ? null : (visibleReplies[index - 1] ?? null),
                false,
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
