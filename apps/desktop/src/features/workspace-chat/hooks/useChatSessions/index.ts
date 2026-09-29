import { useMemo } from 'react';
import type { ChatId, ChatSessionLink, Session, SessionStage } from '@goodboy/types';
import { useAppStore, useSessionStages } from '../../../../store';
import {
  chatSessionEntries,
  mostUrgentStage,
  type ChatSessionEntry,
} from '../../chatSessionEntries';

type Params = {
  readonly chatId: ChatId | null;
};

export type ChatSessions = {
  readonly entries: ReadonlyArray<ChatSessionEntry>;
  readonly stage: SessionStage | null;
};

const NO_LINKS: ReadonlyArray<ChatSessionLink> = [];
const NO_SESSIONS: ReadonlyArray<Session> = [];

export const useChatSessions = ({ chatId }: Params): ChatSessions => {
  const links = useAppStore((state) =>
    chatId === null ? NO_LINKS : (state.chatLinks[chatId] ?? NO_LINKS),
  );
  const sessions = useAppStore((state) => (links.length === 0 ? NO_SESSIONS : state.sessions));
  const linked = useMemo(() => {
    const ids = new Set<string>(links.map((link) => link.sessionId));
    return sessions.filter((session) => ids.has(session.id));
  }, [links, sessions]);
  const stages = useSessionStages(linked);
  return useMemo(() => {
    const entries = chatSessionEntries({ links, sessions: linked, stages });
    return { entries, stage: mostUrgentStage({ entries }) };
  }, [links, linked, stages]);
};
