import { useMemo, useRef } from 'react';
import type { ChatId, ChatMessageId } from '@goodboy/types';
import type { WorkBriefDraft } from '../../workBriefDraft';

type Params = {
  readonly chatId: ChatId | null;
};

type ReadParams = {
  readonly anchorMessageId: ChatMessageId | null;
};

type WriteParams = {
  readonly draft: WorkBriefDraft;
};

export type WorkBriefDrafts = {
  readonly read: (params: ReadParams) => WorkBriefDraft | null;
  readonly write: (params: WriteParams) => void;
  readonly clear: () => void;
};

export const useWorkBriefDrafts = ({ chatId }: Params): WorkBriefDrafts => {
  const saved = useRef(new Map<ChatId, WorkBriefDraft>());
  return useMemo(
    () => ({
      read: ({ anchorMessageId }) => {
        const draft = chatId === null ? undefined : saved.current.get(chatId);
        return draft !== undefined && draft.anchorMessageId === anchorMessageId ? draft : null;
      },
      write: ({ draft }) => {
        if (chatId !== null) {
          saved.current.set(chatId, draft);
        }
      },
      clear: () => {
        if (chatId !== null) {
          saved.current.delete(chatId);
        }
      },
    }),
    [chatId],
  );
};
