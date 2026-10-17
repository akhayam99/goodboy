import { memo } from 'react';
import { Play } from 'lucide-react';
import { CopyButton, Markdown, Notice } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/names';
import { chatAnswerMeta } from '../../chatAnswerMeta';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ChatReads } from './ChatReads';
import { ChatTyping } from './ChatTyping';

type Props = {
  readonly message: ChatMessage;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
};

const PROSE_CLASS = 'text-prose';

const ChatAssistantMessageView = ({ message, workspaceName, onStartWork }: Props) => {
  const isStreaming = message.status === 'streaming';
  const hasText = message.content.trim() !== '';
  const meta = joinFacts({
    facts: [
      chatAnswerMeta({ message }),
      formatDuration({
        durationMs: Math.max(0, Date.parse(message.updatedAt) - Date.parse(message.createdAt)),
      }),
    ],
  });
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
          <div className="flex items-center gap-1">
            {onStartWork === undefined ? null : (
              <button
                type="button"
                onClick={() => onStartWork(message.id)}
                className="flex h-6 items-center gap-1 rounded-md px-2 text-meta text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Play size={ICON_SIZE.row} aria-hidden />
                {NAMES.startWorkFromChat}
              </button>
            )}
          </div>
          <span className="flex-1" />
          {meta === '' ? null : (
            <span className="flex min-w-0 items-center gap-1 pl-2 text-meta text-faint-foreground">
              {message.provider === null ? null : (
                <ProviderGlyph id={message.provider} size={ICON_SIZE.row} />
              )}
              <span className="truncate">{meta}</span>
            </span>
          )}
          <CopyButton
            value={message.content}
            label="Copy the answer"
            presentation="icon"
            tone="faint"
            size={ICON_SIZE.row}
            className="h-6 px-1"
          />
        </div>
      )}
    </div>
  );
};

export const ChatAssistantMessage = memo(ChatAssistantMessageView);
