import { IconButton } from '@goodboy/ui';
import type { ChatSummary } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { useAppStore } from '../../../../store';
import { NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { ChatDeleteConfirm } from '../ChatList/ChatDeleteConfirm';

type FailureParams = {
  readonly title: string;
  readonly error: unknown;
};

type Props = {
  readonly chat: ChatSummary;
  readonly onRemoved: () => void;
};

export const ChatHeaderDelete = ({ chat, onRemoved }: Props) => {
  const deleteChats = useAppStore((state) => state.deleteChats);
  const archiveChats = useAppStore((state) => state.archiveChats);
  const restoreChats = useAppStore((state) => state.restoreChats);
  const showToast = useShowToast();
  const { id: chatId, workspaceId, title } = chat;

  const reportFailure = ({ title: failureTitle, error }: FailureParams): void => {
    void useAppStore
      .getState()
      .reportError({ recovery: NOTHING_CHANGED, title: failureTitle, error, workspaceId });
  };

  const remove = async (): Promise<void> => {
    try {
      await deleteChats({ workspaceId, chatIds: [chatId] });
    } catch (error) {
      reportFailure({ title: "Couldn't delete the chat", error });
      return;
    }
    onRemoved();
  };

  const archive = async (): Promise<void> => {
    try {
      await archiveChats({ workspaceId, chatIds: [chatId] });
    } catch (error) {
      reportFailure({ title: "Couldn't archive the chat", error });
      return;
    }
    useAppStore.getState().undoable({
      showToast,
      title: 'Chat archived',
      message: title,
      undo: async () => {
        await restoreChats({ workspaceId, chatIds: [chatId] });
      },
    });
    onRemoved();
  };

  return (
    <ChatDeleteConfirm
      title={title}
      canArchive={chat.archivedAt === null}
      onDelete={remove}
      onArchive={archive}
      trigger={({ isArmed, arm }) => (
        <IconButton
          icon={CONCEPT_ICONS.delete}
          label="Delete chat"
          tooltip="Delete chat"
          variant="ghost"
          aria-expanded={isArmed}
          aria-haspopup="dialog"
          className="hover:text-danger"
          onClick={arm}
        />
      )}
    />
  );
};
