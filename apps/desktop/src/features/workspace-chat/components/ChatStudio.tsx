import { useEffect, useState } from 'react';
import { Button, EmptyState, StudioRailLayout } from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../shared/components/conceptIcons';
import { StudioShell } from '../../../shared/components/StudioShell';
import { StudioDetail } from '../../../shared/components/StudioShell/StudioDetail';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { useAppStore } from '../../../store';
import { mostRecentChat } from '../../../store/slices/chat-last-open/selectChatDoor';
import { ChatList } from './ChatList';
import { ChatRoom } from './ChatRoom';

type LeaveParams = {
  readonly removedIds: ReadonlyArray<ChatId>;
};

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
  const hasLoadedChats = useAppStore((state) => state.chatsByWorkspace[workspaceId] !== undefined);
  const hasLoadedArchived = useAppStore(
    (state) => state.archivedChatsByWorkspace[workspaceId] !== undefined,
  );
  const loadError = useAppStore((state) => state.chatLoadErrors?.[workspaceId] ?? null);
  const loadArchivedChats = useAppStore((state) => state.loadArchivedChats);
  const [hasStarted, setHasStarted] = useState(false);
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

  useShortcut('chat.newHere', () => {
    setHasStarted(true);
    select(null);
  });

  const leave = ({ removedIds }: LeaveParams): void => {
    if (chatId === null || !removedIds.includes(chatId)) {
      return;
    }
    select(mostRecentChat({ chats, excluding: removedIds }));
  };

  const activeChat =
    chats.find((chat) => chat.id === chatId) ??
    archivedChats.find((chat) => chat.id === chatId) ??
    null;

  const isFirstRun =
    !hasStarted &&
    chatId === null &&
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
          rail={
            isFirstRun ? null : (
              <ChatList
                workspaceId={workspaceId}
                chats={chats}
                selectedId={activeChat?.id ?? null}
                onSelect={select}
                onNew={() => select(null)}
                onArchived={(archivedIds) => leave({ removedIds: archivedIds })}
                onDeleted={(deletedIds) => leave({ removedIds: deletedIds })}
              />
            )
          }
          detail={
            isFirstRun ? (
              <EmptyState
                size="page"
                icon={CONCEPT_ICONS.chat}
                title="No chats yet"
                description="Start a chat to explore an idea with an agent."
                action={
                  <Button size="sm" onClick={() => setHasStarted(true)}>
                    Start a chat
                  </Button>
                }
              />
            ) : (
              <StudioDetail>
                <ChatRoom
                  key={activeChat?.id ?? 'new'}
                  workspaceId={workspaceId}
                  chat={activeChat}
                  onCreated={select}
                  onRemoved={() => leave({ removedIds: chatId === null ? [] : [chatId] })}
                />
              </StudioDetail>
            )
          }
        />
      )}
    </StudioShell>
  );
};
