import type { KeyboardEvent, ReactNode } from 'react';
import { FOCUS_RING, Markdown, cn } from '@goodboy/ui';
import { ConversationAvatar } from './ConversationAvatar';
import { FailedMessageNotice } from './FailedMessageNotice';
import { MessageActionBar } from './MessageActionBar';
import { MessageStatus } from './MessageStatus';
import type { ConversationMessage } from './types';
import type { ConversationFailure } from './useConversation';

type Props = {
  readonly message: ConversationMessage;
  readonly isContinuation: boolean;
  readonly anchor: string | null;
  readonly actions: ReactNode;
  readonly footer: ReactNode;
  readonly failure: ConversationFailure | null;
  readonly onReplyKey: (() => void) | null;
};

export const MessageRow = ({
  message,
  isContinuation,
  anchor,
  actions,
  footer,
  failure,
  onReplyKey,
}: Props) => {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onReplyKey == null || event.target !== event.currentTarget) {
      return;
    }
    if (event.key !== 'r' || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onReplyKey();
  };

  return (
    <div
      data-message-id={message.id}
      data-status={message.status}
      tabIndex={0}
      role="article"
      aria-label={`Message from ${message.author.name}`}
      onKeyDown={onKeyDown}
      className={cn(
        'group group/message relative grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-x-2.5 rounded-md px-1.5 py-1 hover:bg-hover',
        FOCUS_RING,
      )}
    >
      {isContinuation ? <span aria-hidden /> : <ConversationAvatar author={message.author} />}
      <div className="flex min-w-0 flex-col gap-0.5">
        {isContinuation ? null : (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-label font-semibold text-foreground">
              {message.author.name}
            </span>
            <MessageStatus message={message} />
          </div>
        )}
        {anchor == null ? null : (
          <span className="inline-flex h-4.5 w-fit max-w-full items-center truncate rounded-sm bg-muted px-1.5 font-mono text-meta text-muted-foreground">
            {anchor}
          </span>
        )}
        <Markdown
          text={message.body}
          className={cn(
            'text-prose',
            message.status === 'sent' ? 'text-foreground' : 'text-muted-foreground',
          )}
        />
        {footer}
        {failure == null ? null : <FailedMessageNotice failure={failure} />}
      </div>
      {actions == null ? null : <MessageActionBar>{actions}</MessageActionBar>}
    </div>
  );
};
