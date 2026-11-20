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

const reselect = ({ workspaceId, chatId }: ReselectParams): void => {
  const state = useAppStore.getState();
  if (state.currentWorkspaceId !== workspaceId) {
    return;
  }
  state.amendStudio({ studio: { kind: 'chat', chatId } });
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
    undo: async () => {
      await useAppStore.getState().restoreChats({ workspaceId, chatIds });
      if (reselectId !== null) {
        reselect({ workspaceId, chatId: reselectId });
      }
    },
  });
};
