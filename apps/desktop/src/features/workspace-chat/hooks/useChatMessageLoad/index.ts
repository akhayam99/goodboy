import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ChatId, ChatMessage } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly chatId: ChatId | null;
};

type LoadParams = {
  readonly chatId: ChatId;
};

type LoadFailure = {
  readonly chatId: ChatId;
  readonly detail: string;
};

const NO_MESSAGES: ReadonlyArray<ChatMessage> = [];

export const useChatMessageLoad = ({ chatId }: Params) => {
  const messages = useAppStore((state) =>
    chatId === null ? NO_MESSAGES : state.chatMessages[chatId],
  );
  const loadChatMessages = useAppStore((state) => state.loadChatMessages);
  const [loadFailure, setLoadFailure] = useState<LoadFailure | null>(null);

  const loadMessages = useCallback(
    ({ chatId: target }: LoadParams): void => {
      setLoadFailure(null);
      loadChatMessages({ chatId: target }).catch((error: unknown) => {
        setLoadFailure({ chatId: target, detail: formatError(error) });
      });
    },
    [loadChatMessages],
  );

  useEffect(() => {
    if (chatId === null || messages !== undefined) {
      return;
    }
    loadMessages({ chatId });
  }, [chatId, messages, loadMessages]);

  const failedLoad = loadFailure !== null && loadFailure.chatId === chatId ? loadFailure : null;
  return { messages, failedLoad, loadMessages };
};
