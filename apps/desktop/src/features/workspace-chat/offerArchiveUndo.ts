import type { ChatId, WorkspaceId } from '@goodboy/types';
import type { ShowToast } from '../../shared/components/Toast';
import { undoable } from '../../shared/utils/undoable';
import { useAppStore } from '../../store';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly chatIds: ReadonlyArray<ChatId>;
  readonly title?: string;
  readonly message: string;
  readonly selectedId: ChatId | null;
  readonly showToast: ShowToast;
};

type ReselectParams = {
  readonly workspaceId: WorkspaceId;
  readonly chatId: ChatId;
};

type ChatsParams = {
  readonly workspaceId: WorkspaceId;
  readonly chatIds: ReadonlyArray<ChatId>;
};

const CONFLICT_MESSAGE = 'Nothing changed. The chat is no longer archived.';

const reselect = ({ workspaceId, chatId }: ReselectParams): void => {
  const state = useAppStore.getState();
  if (state.currentWorkspaceId !== workspaceId) {
    return;
  }
  if (state.appStudio?.kind === 'chat') {
    state.amendStudio({ studio: { kind: 'chat', chatId } });
    return;
  }
  state.openStudio({ studio: { kind: 'chat', chatId } });
};

const isStillArchived = ({ workspaceId, chatIds }: ChatsParams): boolean => {
  const archived = useAppStore.getState().archivedChatsByWorkspace[workspaceId];
  if (archived === undefined) {
    return true;
  }
  return archived.some((chat) => chatIds.includes(chat.id));
};

const listedOf = ({ workspaceId, chatIds }: ChatsParams): ReadonlyArray<ChatId> => {
  const listed = useAppStore.getState().chatsByWorkspace[workspaceId] ?? [];
  return chatIds.filter((chatId) => listed.some((chat) => chat.id === chatId));
};

export const offerArchiveUndo = ({
  workspaceId,
  chatIds,
  title,
  message,
  selectedId,
  showToast,
}: Params): void => {
  const reselectId = selectedId !== null && chatIds.includes(selectedId) ? selectedId : null;
  undoable({
    showToast,
    message,
    ...(title === undefined ? {} : { title }),
    conflictMessage: CONFLICT_MESSAGE,
    isCurrent: () => isStillArchived({ workspaceId, chatIds }),
    undo: async () => {
      await useAppStore.getState().restoreChats({ workspaceId, chatIds });
      const restored = listedOf({ workspaceId, chatIds });
      if (reselectId !== null && restored.includes(reselectId)) {
        reselect({ workspaceId, chatId: reselectId });
      }
      return restored.length;
    },
  });
};
