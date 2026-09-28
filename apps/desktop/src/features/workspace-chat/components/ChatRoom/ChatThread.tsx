import { useLayoutEffect, useRef } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId } from '@goodboy/types';
import { ChatAssistantMessage } from './ChatAssistantMessage';
import { ChatUserMessage } from './ChatUserMessage';

type Props = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
};

const STICK_PX = 48;

export const ChatThread = ({ messages, workspaceName, onStartWork }: Props) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isPinnedRef = useRef(true);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || !isPinnedRef.current) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const onScroll = (): void => {
    const viewport = viewportRef.current;
    if (viewport === null) {
      return;
    }
    isPinnedRef.current =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < STICK_PX;
  };

  return (
    <ScrollFade className="flex-1" viewportRef={viewportRef} onViewportScroll={onScroll}>
      <ol
        aria-label="Messages"
        className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-5 pt-1.5 select-text"
      >
        {messages.map((message) => (
          <li key={message.id} className="flex flex-col">
            {message.role === 'user' ? (
              <ChatUserMessage content={message.content} />
            ) : (
              <ChatAssistantMessage
                message={message}
                workspaceName={workspaceName}
                {...(onStartWork !== undefined && { onStartWork })}
              />
            )}
          </li>
        ))}
      </ol>
    </ScrollFade>
  );
};
