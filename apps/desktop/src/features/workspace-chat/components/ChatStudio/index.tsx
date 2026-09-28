import { useEffect, useState } from 'react';
import { StudioRailLayout } from '@goodboy/ui';
import type { ChatId, ChatSummary, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import type { ChatHandoff } from '../../chatHandoff';
import { ChatList } from '../ChatList';
import { ChatRoom } from '../ChatRoom';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId | null;
  readonly onClose: () => void;
};

const NO_CHATS: ReadonlyArray<ChatSummary> = [];
const NO_HANDOFFS: ReadonlyArray<ChatHandoff> = [];

export const ChatStudio = ({ workspaceId, chatId, onClose }: Props) => {
  const chats = useAppStore((state) => state.chatsByWorkspace[workspaceId] ?? NO_CHATS);
  const loadChats = useAppStore((state) => state.loadChats);
  const amendStudio = useAppStore((state) => state.amendStudio);
  const [handoffs, setHandoffs] = useState<Readonly<Record<string, ReadonlyArray<ChatHandoff>>>>(
    {},
  );

  useEffect(() => {
    void loadChats({ workspaceId });
  }, [workspaceId, loadChats]);

  const select = (next: ChatId | null): void =>
    amendStudio({ studio: { kind: 'chat', chatId: next } });

  const activeChat = chats.find((chat) => chat.id === chatId) ?? null;

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
            />
          }
          detail={
            <ChatRoom
              key={activeChat?.id ?? 'new'}
              workspaceId={workspaceId}
              chat={activeChat}
              onCreated={select}
              handoffs={
                activeChat === null ? NO_HANDOFFS : (handoffs[activeChat.id] ?? NO_HANDOFFS)
              }
              onHandoff={(handoff) => {
                if (activeChat === null) {
                  return;
                }
                setHandoffs((current) => ({
                  ...current,
                  [activeChat.id]: [...(current[activeChat.id] ?? []), handoff],
                }));
              }}
            />
          }
        />
      )}
    </StudioShell>
  );
};
