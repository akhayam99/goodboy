import { useLayoutEffect, useRef } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId } from '@goodboy/types';
import type { ChatHandoff } from '../../chatHandoff';
import { ChatAssistantMessage } from './ChatAssistantMessage';
import { ChatHandoffNote } from './ChatHandoffNote';
import { ChatUserMessage } from './ChatUserMessage';

type Props = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
  readonly handoffs?: ReadonlyArray<ChatHandoff>;
  readonly onOpenHandoff?: (handoff: ChatHandoff) => void;
};

const NO_HANDOFFS: ReadonlyArray<ChatHandoff> = [];

const STICK_PX = 48;

export const ChatThread = ({
  messages,
  workspaceName,
  onStartWork,
  handoffs = NO_HANDOFFS,
  onOpenHandoff,
}: Props) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isPinnedRef = useRef(true);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || !isPinnedRef.current) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, handoffs]);

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
        {onOpenHandoff === undefined
          ? null
          : handoffs.map((handoff) => (
              <li key={handoff.id} className="flex flex-col">
                <ChatHandoffNote handoff={handoff} onOpen={onOpenHandoff} />
              </li>
            ))}
      </ol>
    </ScrollFade>
  );
};
