import { useEffect } from 'react';
import { StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioShell } from '../../../shared/components/StudioShell';
import { StudioDetail } from '../../../shared/components/StudioShell/StudioDetail';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { useAppStore } from '../../../store';
import { nextChatAfter, type RemovedChats } from '../nextChatAfter';
import { ChatList } from './ChatList';
import { chatGroupRowsOf } from './ChatList/chatGroupRowsOf';
import { chatOrderOf } from './ChatList/chatOrderOf';
import { ChatRoom } from './ChatRoom';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId | null;
  readonly onClose: () => void;
};

const NO_CHATS: ReadonlyArray<ChatSummary> = [];

export const ChatStudio = ({ workspaceId, chatId, onClose }: Props) => {
  const fold = useStudioRailFold({ surface: 'chat' });
  const chats = useAppStore((state) => state.chatsByWorkspace[workspaceId] ?? NO_CHATS);
  const archivedChats = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] ?? NO_CHATS,
  );
  const hasLoadedChats = useAppStore((state) => state.chatsByWorkspace[workspaceId] !== undefined);
  const hasLoadedArchived = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] !== undefined,
  );
  const loadError = useAppStore((state) => state.chatLoadErrors?.[workspaceId] ?? null);
  const loadArchivedChats = useAppStore((state) => state.loadArchivedChats);
  const loadChats = useAppStore((state) => state.loadChats);
  const amendStudio = useAppStore((state) => state.amendStudio);
  const markChatRead = useAppStore((state) => state.markChatRead);
  const rememberLastChat = useAppStore((state) => state.rememberLastChat);

  useEffect(() => {
    void loadChats({ workspaceId });
  }, [workspaceId, loadChats]);

  useEffect(() => {
    void loadArchivedChats({ workspaceId });
  }, [workspaceId, loadArchivedChats]);

  useEffect(() => {
    if (chatId !== null) {
      markChatRead({ chatId });
    }
  }, [chatId, markChatRead]);

  useEffect(() => {
    rememberLastChat({ workspaceId, chatId });
  }, [workspaceId, chatId, rememberLastChat]);

  const select = (next: ChatId | null): void =>
    amendStudio({ studio: { kind: 'chat', chatId: next } });

  const startNewChat = (): void => select(null);

  useShortcut('chat.newHere', startNewChat);

  const leave = ({ removedIds, order }: RemovedChats): void => {
    if (chatId === null || !removedIds.includes(chatId)) {
      return;
    }
    select(nextChatAfter({ order, selectedId: chatId, removedIds }));
  };

  const leaveRoom = (): void => {
    if (chatId === null) {
      return;
    }
    const groups = chatGroupRowsOf({ chats, needle: '', now: Date.now() });
    leave({ removedIds: [chatId], order: chatOrderOf({ groups }) });
  };

  const activeChat =
    chats.find((chat) => chat.id === chatId) ??
    archivedChats.find((chat) => chat.id === chatId) ??
    null;

  const hasNoChats =
    hasLoadedChats &&
    hasLoadedArchived &&
    loadError === null &&
    chats.length === 0 &&
    archivedChats.length === 0;

  return (
    <StudioShell icon={CONCEPT_ICONS.chat} tone={CONCEPT_TONE.chat} title="Chat" onClose={onClose}>
      {() => (
        <StudioRailLayout
          railLabel="Chat list"
          railWidth="standard"
          surface="chat"
          placement="page"
          isCollapsed={fold.isCollapsed}
          onCollapsedChange={fold.setFolded}
          rail={
            hasNoChats ? null : (
              <ChatList
                workspaceId={workspaceId}
                chats={chats}
                selectedId={activeChat?.id ?? null}
                onSelect={select}
                onArchived={leave}
                onDeleted={leave}
              />
            )
          }
          detail={
            <StudioDetail>
              <ChatRoom
                key={activeChat?.id ?? 'new'}
                workspaceId={workspaceId}
                chat={activeChat}
                onCreated={select}
                onRemoved={leaveRoom}
                onNewChat={startNewChat}
              />
            </StudioDetail>
          }
        />
      )}
    </StudioShell>
  );
};
