import { Check, MessageSquareReply, TextQuote, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { MessageAction } from './MessageAction';
import type { ConversationMessage, ConversationSource, ConversationThread } from './types';
import type { ConversationModel } from './useConversation';

type Params = {
  readonly thread: ConversationThread;
  readonly message: ConversationMessage;
  readonly isHead: boolean;
  readonly source: ConversationSource;
  readonly model: ConversationModel;
  readonly isResolving: boolean;
  readonly onResolve: (() => void) | null;
};

export const replyActionOf = ({
  thread,
  message,
  source,
  model,
}: Pick<Params, 'thread' | 'message' | 'source' | 'model'>): (() => void) | null => {
  const mode = source.capabilities.reply;
  if (!model.canSend || message.status !== 'sent' || mode === 'none') {
    return null;
  }
  return () => model.choose({ threadId: thread.id, message, mode });
};

export const messageActions = ({
  thread,
  message,
  isHead,
  source,
  model,
  isResolving,
  onResolve,
}: Params): ReactNode => {
  const reply = replyActionOf({ thread, message, source, model });
  const isQuote = source.capabilities.reply === 'quote';
  const canResolve = isHead && onResolve != null && message.status === 'sent';

  if (reply == null && !canResolve) {
    return null;
  }

  return (
    <>
      {reply == null ? null : (
        <MessageAction
          icon={isQuote ? TextQuote : MessageSquareReply}
          label={isQuote ? 'Quote' : 'Reply'}
          tooltip={
            isQuote ? `No threads on ${source.toolLabel}. Your comment quotes this message.` : null
          }
          onRun={reply}
        />
      )}
      {canResolve ? (
        <MessageAction
          icon={thread.isResolved === true ? Undo2 : Check}
          label={thread.isResolved === true ? 'Unresolve' : 'Resolve'}
          tooltip={null}
          isDisabled={isResolving}
          onRun={onResolve}
        />
      ) : null}
    </>
  );
};
