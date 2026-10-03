import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ChatId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionTitle } from '../../../session/sessionTitle';

type Params = {
  readonly chatId: ChatId | null;
};

export type ChatDraft = {
  readonly session: Session;
  readonly title: string;
};

export const useChatDrafts = ({ chatId }: Params): ReadonlyArray<ChatDraft> => {
  const sessionIds = useAppStore(
    useShallow((state) =>
      Object.entries(state.pendingChatLinks ?? {}).flatMap(([sessionId, pending]) =>
        chatId !== null && pending.some((link) => link.chatId === chatId) ? [sessionId] : [],
      ),
    ),
  );
  const sessions = useAppStore((state) => state.sessions);
  return useMemo(
    () =>
      sessions
        .filter((session) => sessionIds.includes(session.id))
        .map((session) => ({ session, title: sessionTitle({ session }) })),
    [sessionIds, sessions],
  );
};
