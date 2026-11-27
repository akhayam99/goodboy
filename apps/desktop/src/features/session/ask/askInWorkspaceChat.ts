import { CHECK_STATE } from '../../../store/slices/notifications/errorRecovery';
import type { ChatId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { defaultRoutingOfWorkspace } from '../../workspace-chat/defaultRoutingOfWorkspace';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly question: string;
};

export const askInWorkspaceChat = async ({
  workspaceId,
  question,
}: Params): Promise<ChatId | null> => {
  const text = question.trim();
  if (text === '') {
    return null;
  }
  const state = useAppStore.getState();
  try {
    const { provider, model, effort } = await defaultRoutingOfWorkspace({ state, workspaceId });
    const chatId = await state.createChat({ workspaceId, provider, model });
    if (effort !== null) {
      await state.setChatModel({ chatId, provider, model, effort });
    }
    await useAppStore.getState().sendChatMessage({ chatId, content: text });
    return chatId;
  } catch (error) {
    void useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't start the chat", error, workspaceId });
    return null;
  }
};
