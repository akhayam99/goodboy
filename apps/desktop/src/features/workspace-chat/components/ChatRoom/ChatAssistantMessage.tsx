import { memo } from 'react';
import { Play } from 'lucide-react';
import { CopyButton, Markdown, Notice } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ChatReads } from './ChatReads';
import { ChatTyping } from './ChatTyping';

type Props = {
  readonly message: ChatMessage;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
};

const ChatAssistantMessageView = ({ message, workspaceName, onStartWork }: Props) => {
  const isStreaming = message.status === 'streaming';
  const hasText = message.content.trim() !== '';
  if (message.status === 'failed') {
    return (
      <div data-chat-message="assistant" className="flex flex-col gap-2">
        {hasText ? <Markdown text={message.content} className="text-prose" /> : null}
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title="No answer"
          body={message.error ?? 'The provider stopped without an answer.'}
        />
      </div>
    );
  }
  return (
    <div
      data-chat-message="assistant"
      aria-busy={isStreaming ? true : undefined}
      className="flex flex-col gap-2"
    >
      {hasText ? <Markdown text={message.content} className="text-prose" /> : null}
      {isStreaming && !hasText ? <ChatTyping workspaceName={workspaceName} /> : null}
      <ChatReads reads={message.reads} />
      {message.status === 'stopped' ? (
        <p className="text-secondary text-faint-foreground">Stopped</p>
      ) : null}
      {isStreaming || !hasText ? null : (
        <div className="-ml-1.5 flex items-center gap-1">
          <CopyButton
            value={message.content}
            label="Copy the answer"
            presentation="icon"
            tone="faint"
            size={ICON_SIZE.row}
            className="h-6 gap-1 px-1.5 text-secondary"
          >
            Copy
          </CopyButton>
          {onStartWork === undefined ? null : (
            <button
              type="button"
              onClick={() => onStartWork(message.id)}
              className="flex h-6 items-center gap-1 rounded-md px-1.5 text-secondary text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <Play size={ICON_SIZE.row} aria-hidden />
              Start work from here
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ChatAssistantMessage = memo(ChatAssistantMessageView);
