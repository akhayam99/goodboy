import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import { useAppStore } from '../../store';
import { defaultRoutingOfWorkspace } from './defaultRoutingOfWorkspace';

type Params = {
  readonly question: string;
};

export const askInChat = async ({ question }: Params): Promise<void> => {
  const text = question.trim();
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (text === '' || workspaceId === null) {
    return;
  }
  try {
    const { provider, model, effort } = await defaultRoutingOfWorkspace({ state, workspaceId });
    const chatId = await state.createChat({ workspaceId, provider, model });
    if (effort !== null) {
      await state.setChatModel({ chatId, provider, model, effort });
    }
    useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId } });
    await useAppStore.getState().sendChatMessage({ chatId, content: text });
  } catch (error) {
    void useAppStore
      .getState()
      .reportError({ recovery: CHECK_STATE, title: "Couldn't start the chat", error, workspaceId });
  }
};
