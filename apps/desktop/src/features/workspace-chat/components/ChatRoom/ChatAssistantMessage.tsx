import { memo } from 'react';
import { Play } from 'lucide-react';
import { CopyButton, Markdown, Notice } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { chatAnswerMeta } from '../../chatAnswerMeta';
import { ChatReads } from './ChatReads';
import { ChatTyping } from './ChatTyping';

type Props = {
  readonly message: ChatMessage;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
};

const PROSE_CLASS = [
  'text-prose',
  '[&>div>p]:max-w-[var(--measure)]',
  '[&>div>ul]:max-w-[var(--measure)]',
  '[&>div>ol]:max-w-[var(--measure)]',
  '[&>div>blockquote]:max-w-[var(--measure)]',
  '[&>div>h1]:max-w-[var(--measure)]',
  '[&>div>h2]:max-w-[var(--measure)]',
  '[&>div>h3]:max-w-[var(--measure)]',
  '[&>div>h4]:max-w-[var(--measure)]',
].join(' ');

const ChatAssistantMessageView = ({ message, workspaceName, onStartWork }: Props) => {
  const isStreaming = message.status === 'streaming';
  const hasText = message.content.trim() !== '';
  const meta = chatAnswerMeta({ message });
  if (message.status === 'failed') {
    return (
      <div data-chat-message="assistant" className="flex flex-col gap-2">
        {hasText ? <Markdown text={message.content} className={PROSE_CLASS} /> : null}
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
      className="group/answer flex flex-col gap-2"
    >
      {hasText ? <Markdown text={message.content} className={PROSE_CLASS} /> : null}
      {isStreaming && !hasText ? <ChatTyping workspaceName={workspaceName} /> : null}
      <ChatReads reads={message.reads} />
      {message.status === 'stopped' ? (
        <p className="text-meta text-faint-foreground">Stopped</p>
      ) : null}
      {isStreaming || !hasText ? null : (
        <div className="-ml-2 flex h-7 items-center gap-1">
          <div className="flex items-center gap-1 opacity-0 motion-safe:transition-opacity group-focus-within/answer:opacity-100 group-hover/answer:opacity-100">
            <CopyButton
              value={message.content}
              label="Copy the answer"
              presentation="icon"
              tone="faint"
              size={ICON_SIZE.row}
              className="h-6 gap-1 px-2 text-meta"
            >
              Copy
            </CopyButton>
            {onStartWork === undefined ? null : (
              <button
                type="button"
                onClick={() => onStartWork(message.id)}
                className="flex h-6 items-center gap-1 rounded-md px-2 text-meta text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Play size={ICON_SIZE.row} aria-hidden />
                Start work from here
              </button>
            )}
          </div>
          <span className="flex-1" />
          {meta === null ? null : (
            <span className="truncate pl-2 text-meta text-faint-foreground">{meta}</span>
          )}
        </div>
      )}
    </div>
  );
};

export const ChatAssistantMessage = memo(ChatAssistantMessageView);
