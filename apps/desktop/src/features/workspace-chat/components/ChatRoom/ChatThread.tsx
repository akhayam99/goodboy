import { Fragment, useLayoutEffect, useMemo, useRef } from 'react';
import { PageColumn, ScrollFade } from '@goodboy/ui';
import type { ChatMessage, ChatMessageId, SessionId } from '@goodboy/types';
import type { ChatSessionEntry } from '../../chatSessionEntries';
import { ChatAssistantMessage } from './ChatAssistantMessage';
import { ChatHandoffNote } from './ChatHandoffNote';
import { ChatUserMessage } from './ChatUserMessage';

type Props = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly workspaceName: string;
  readonly onStartWork?: (messageId: ChatMessageId) => void;
  readonly sessions: ReadonlyArray<ChatSessionEntry>;
  readonly onOpenSession: (sessionId: SessionId) => void;
};

const STICK_PX = 48;

type NotesParams = {
  readonly messages: ReadonlyArray<ChatMessage>;
  readonly sessions: ReadonlyArray<ChatSessionEntry>;
};

const notesByMessage = ({ messages, sessions }: NotesParams) => {
  const known = new Set<string>(messages.map((message) => message.id));
  const after = new Map<string, ChatSessionEntry[]>();
  const trailing: ChatSessionEntry[] = [];
  for (const entry of sessions) {
    const messageId = entry.link.messageId;
    if (messageId === null || !known.has(messageId)) {
      trailing.push(entry);
      continue;
    }
    after.set(messageId, [...(after.get(messageId) ?? []), entry]);
  }
  return { after, trailing };
};

export const ChatThread = ({
  messages,
  workspaceName,
  onStartWork,
  sessions,
  onOpenSession,
}: Props) => {
  const notes = useMemo(() => notesByMessage({ messages, sessions }), [messages, sessions]);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const isPinnedRef = useRef(true);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null || !isPinnedRef.current) {
      return;
    }
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, sessions]);

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
      <PageColumn>
        <ol aria-label="Messages" className="flex w-full flex-col gap-4 pb-5 pt-1.5 select-text">
          {messages.map((message) => (
            <Fragment key={message.id}>
              <li className="flex flex-col">
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
              {notes.after.get(message.id)?.map((entry) => (
                <li key={entry.link.id} className="flex flex-col">
                  <ChatHandoffNote entry={entry} onOpen={onOpenSession} />
                </li>
              ))}
            </Fragment>
          ))}
          {notes.trailing.map((entry) => (
            <li key={entry.link.id} className="flex flex-col">
              <ChatHandoffNote entry={entry} onOpen={onOpenSession} />
            </li>
          ))}
        </ol>
      </PageColumn>
    </ScrollFade>
  );
};
