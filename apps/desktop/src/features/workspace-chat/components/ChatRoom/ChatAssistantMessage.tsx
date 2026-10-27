import { memo } from 'react';
import { Play } from 'lucide-react';
import { CopyButton, ICON_SIZE, Markdown, Notice, FOCUS_RING, cn } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId } from '@goodboy/types';

import { NAMES } from '../../../../shared/utils/names';
import { chatAnswerMeta } from '../../chatAnswerMeta';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { useRevealedMarkdown } from '../../../chat/reveal/useRevealedMarkdown';
import { ChatReads } from './ChatReads';
import { ChatTyping } from './ChatTyping';

type Props = {
  readonly message: ChatMessage;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
};

const PROSE_CLASS = 'text-prose';
const REPLY_ITEM_KEY = 'reply';

const ChatAssistantMessageView = ({ message, workspaceName, onStartWork }: Props) => {
  const isStreaming = message.status === 'streaming';
  const reveal = useRevealedMarkdown({
    runId: message.id,
    itemKey: REPLY_ITEM_KEY,
    text: message.content,
    isComplete: !isStreaming,
  });
  const isWriting = isStreaming || reveal.isRevealing;
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
      ref={reveal.rootRef}
      data-chat-message="assistant"
      aria-busy={isWriting ? true : undefined}
      className="group/answer flex flex-col gap-2"
    >
      {hasText && reveal.text !== '' ? (
        <Markdown text={reveal.text} fresh={reveal.fresh} className={PROSE_CLASS} />
      ) : null}
      {isWriting && reveal.text === '' ? <ChatTyping workspaceName={workspaceName} /> : null}
      <ChatReads reads={message.reads} />
      {message.status === 'stopped' ? (
        <p className="text-meta text-faint-foreground">Stopped</p>
      ) : null}
      {isWriting || !hasText ? null : (
        <div className="-ml-2 flex h-7 items-center gap-1">
          <div className="flex items-center gap-1">
            {onStartWork === undefined ? null : (
              <button
                type="button"
                onClick={() => onStartWork(message.id)}
                className={cn(
                  'flex h-6 items-center gap-1 rounded-md px-2 text-meta text-faint-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground',
                  FOCUS_RING,
                )}
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
