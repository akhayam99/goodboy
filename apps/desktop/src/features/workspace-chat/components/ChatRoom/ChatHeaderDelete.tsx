import { useState } from 'react';
import { IconButton } from '@goodboy/ui';
import type { ChatSummary } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { useAppStore } from '../../../../store';
import { ChatDeleteConfirm } from '../ChatList/ChatDeleteConfirm';

type Props = {
  readonly chat: ChatSummary;
  readonly onRemoved: () => void;
};

export const ChatHeaderDelete = ({ chat, onRemoved }: Props) => {
  const deleteChats = useAppStore((state) => state.deleteChats);
  const archiveChats = useAppStore((state) => state.archiveChats);
  const restoreChats = useAppStore((state) => state.restoreChats);
  const showToast = useShowToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const { id: chatId, workspaceId, title } = chat;

  const remove = async (): Promise<void> => {
    await deleteChats({ workspaceId, chatIds: [chatId] });
    onRemoved();
  };

  const archive = (): void => {
    void archiveChats({ workspaceId, chatIds: [chatId] });
    showToast({
      kind: 'info',
      title: 'Chat archived',
      message: title,
      action: {
        label: 'Undo',
        onClick: () => void restoreChats({ workspaceId, chatIds: [chatId] }),
      },
    });
    onRemoved();
  };

  return (
    <span className="relative flex shrink-0">
      <IconButton
        icon={CONCEPT_ICONS.delete}
        label="Delete chat"
        tooltip="Delete chat"
        variant="ghost"
        aria-expanded={isConfirming}
        className="hover:text-danger"
        onClick={() => setIsConfirming((current) => !current)}
      />
      {isConfirming ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[calc(100cqw-2rem)] rounded-lg bg-background shadow-lg">
          <ChatDeleteConfirm
            title={title}
            canArchive={chat.archivedAt === null}
            onDelete={remove}
            onArchive={archive}
            onCancel={() => setIsConfirming(false)}
          />
        </div>
      ) : null}
    </span>
  );
};
