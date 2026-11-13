import type { ReactNode } from 'react';
import { PageHeader, RevealRegion, TruncatedText } from '@goodboy/ui';
import type { ChatSummary, SessionId } from '@goodboy/types';
import type { ChatSessions } from '../../hooks/useChatSessions';
import { ChatHeaderDelete } from './ChatHeaderDelete';
import { ChatSessionsChip } from './ChatSessionsChip';

type Props = {
  readonly title: string;
  readonly chat: ChatSummary | null;
  readonly linked: ChatSessions;
  readonly onOpenSession: (sessionId: SessionId) => void;
  readonly onRemoved: () => void;
  readonly children: ReactNode;
};

export const ChatHeader = ({ title, chat, linked, onOpenSession, onRemoved, children }: Props) => (
  <RevealRegion
    header={
      <header className="shrink-0">
        <PageHeader
          page="chat"
          animationClassName=""
          title={<TruncatedText>{title}</TruncatedText>}
          actions={
            <>
              {linked.stage === null || linked.entries.length < 2 ? null : (
                <ChatSessionsChip
                  entries={linked.entries}
                  stage={linked.stage}
                  onOpen={onOpenSession}
                />
              )}
              {chat === null ? null : <ChatHeaderDelete chat={chat} onRemoved={onRemoved} />}
            </>
          }
        />
      </header>
    }
  >
    {children}
  </RevealRegion>
);
