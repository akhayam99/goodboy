import { useAppStore } from '../../store';
import { defaultChatModel } from './defaultChatModel';

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
    const connected = state.providers
      .filter((provider) => provider.connection === 'connected')
      .map((provider) => provider.id);
    const { provider, model } = defaultChatModel({ connected });
    const chatId = await state.createChat({ workspaceId, provider, model });
    useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId } });
    await useAppStore.getState().sendChatMessage({ chatId, content: text });
  } catch (error) {
    void useAppStore
      .getState()
      .reportError({ title: "Couldn't start the chat", error, workspaceId });
  }
};
