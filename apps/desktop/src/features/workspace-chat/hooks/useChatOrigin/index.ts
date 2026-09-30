import { useEffect } from 'react';
import type { ChatId, ChatSessionLink, ChatSummary, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';

export type ChatOrigin = {
  readonly chatId: ChatId;
  readonly title: string;
};

type Params = {
  readonly session: Pick<Session, 'id' | 'workspaceId'>;
};

const earlier = (a: ChatSessionLink, b: ChatSessionLink): ChatSessionLink =>
  a.createdAt <= b.createdAt ? a : b;

export const useChatOrigin = ({ session }: Params): ChatOrigin | null => {
  const { id: sessionId, workspaceId } = session;
  const isChatsLoaded = useAppStore((state) => state.chatsByWorkspace[workspaceId] !== undefined);
  const isArchivedLoaded = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] !== undefined,
  );
  const loadChats = useAppStore((state) => state.loadChats);
  const loadArchivedChats = useAppStore((state) => state.loadArchivedChats);
  const link = useAppStore((state) => {
    let found: ChatSessionLink | null = null;
    for (const links of Object.values(state.chatLinks)) {
      for (const candidate of links) {
        if (candidate.sessionId === sessionId && candidate.kind === 'new') {
          found = found === null ? candidate : earlier(found, candidate);
        }
      }
    }
    return found;
  });
  const chat = useAppStore((state): ChatSummary | null => {
    if (link === null) {
      return null;
    }
    const live = state.chatsByWorkspace[workspaceId] ?? [];
    const archived = state.archivedChatsByWorkspace[workspaceId] ?? [];
    return [...live, ...archived].find((candidate) => candidate.id === link.chatId) ?? null;
  });

  useEffect(() => {
    if (!isChatsLoaded) {
      void loadChats({ workspaceId });
    }
  }, [isChatsLoaded, loadChats, workspaceId]);

  useEffect(() => {
    if (link !== null && !isArchivedLoaded) {
      void loadArchivedChats({ workspaceId });
    }
  }, [link, isArchivedLoaded, loadArchivedChats, workspaceId]);

  if (link === null || chat === null) {
    return null;
  }
  return { chatId: chat.id, title: chat.title };
};
