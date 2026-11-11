import { useState, type ReactNode } from 'react';
import type { ChatMessage, ChatMessageId, ChatSummary } from '@goodboy/types';
import { TurnIntoWorkPanel } from '../../components/TurnIntoWorkPanel';
import { useWorkBriefDrafts } from '../useWorkBriefDrafts';

type Params = {
  readonly chat: ChatSummary | null;
  readonly messages: ReadonlyArray<ChatMessage>;
};

type WorkRequest = {
  readonly anchorMessageId: ChatMessageId | null;
  readonly key: number;
};

export type ChatWork = {
  readonly drawerNode: ReactNode;
  readonly drawerKey: string;
  readonly openWork: (params: Pick<WorkRequest, 'anchorMessageId'>) => void;
  readonly closeWork: () => void;
};

export const useChatWork = ({ chat, messages }: Params): ChatWork => {
  const [work, setWork] = useState<WorkRequest | null>(null);
  const drafts = useWorkBriefDrafts({ chatId: chat?.id ?? null });
  const close = (): void => setWork(null);
  return {
    drawerNode:
      work === null || chat === null ? null : (
        <TurnIntoWorkPanel
          chat={chat}
          messages={messages}
          anchorMessageId={work.anchorMessageId}
          drafts={drafts}
          onClose={close}
          onDone={close}
        />
      ),
    drawerKey: String(work?.key ?? 0),
    closeWork: close,
    openWork: ({ anchorMessageId }) =>
      setWork((current) => ({ anchorMessageId, key: (current?.key ?? 0) + 1 })),
  };
};
