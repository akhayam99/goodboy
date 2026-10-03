import { useEffect } from 'react';
import { StudioRailLayout } from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioShell } from '../../../shared/components/StudioShell';
import { useAppStore } from '../../../store';
import { ChatList } from './ChatList';
import { ChatRoom } from './ChatRoom';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId | null;
  readonly onClose: () => void;
};

const NO_CHATS: ReadonlyArray<ChatSummary> = [];

export const ChatStudio = ({ workspaceId, chatId, onClose }: Props) => {
  const chats = useAppStore((state) => state.chatsByWorkspace[workspaceId] ?? NO_CHATS);
  const archivedChats = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] ?? NO_CHATS,
  );
  const loadChats = useAppStore((state) => state.loadChats);
  const amendStudio = useAppStore((state) => state.amendStudio);
  const markChatRead = useAppStore((state) => state.markChatRead);

  useEffect(() => {
    void loadChats({ workspaceId });
  }, [workspaceId, loadChats]);

  useEffect(() => {
    if (chatId !== null) {
      markChatRead({ chatId });
    }
  }, [chatId, markChatRead]);

  const select = (next: ChatId | null): void =>
    amendStudio({ studio: { kind: 'chat', chatId: next } });

  const activeChat =
    chats.find((chat) => chat.id === chatId) ??
    archivedChats.find((chat) => chat.id === chatId) ??
    null;

  return (
    <StudioShell
      icon={CONCEPT_ICONS.chat}
      tone={CONCEPT_TONE.chat}
      title="Chat"
      closeLabel="close chat"
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Chat list"
          railWidth="narrow"
          surface="chat"
          rail={
            <ChatList
              workspaceId={workspaceId}
              chats={chats}
              selectedId={activeChat?.id ?? null}
              onSelect={select}
              onNew={() => select(null)}
              onArchived={(archivedIds) => {
                if (chatId !== null && archivedIds.includes(chatId)) {
                  select(null);
                }
              }}
              onDeleted={(deletedIds) => {
                if (chatId !== null && deletedIds.includes(chatId)) {
                  select(null);
                }
              }}
            />
          }
          detail={
            <ChatRoom
              key={activeChat?.id ?? 'new'}
              workspaceId={workspaceId}
              chat={activeChat}
              onCreated={select}
            />
          }
        />
      )}
    </StudioShell>
  );
};
