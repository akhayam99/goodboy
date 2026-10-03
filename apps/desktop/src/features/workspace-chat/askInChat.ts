import { useAppStore } from '../../store';
import { chatDefaultModelKey, parseChatDefaultModel } from './chatDefaultModelSetting';
import { defaultChatRouting } from './defaultChatRouting';
import { selectWorkspaceResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';

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
    const key = chatDefaultModelKey({ workspaceId });
    const raw = state.settings[key] ?? (await state.loadSetting(key).catch(() => null));
    const { provider, model, effort } = defaultChatRouting({
      connected,
      saved: parseChatDefaultModel({ raw }),
      workspaceDefaultProvider: selectWorkspaceResolvedSettings({ state, workspaceId })
        .defaultProviderOverride,
    });
    const chatId = await state.createChat({ workspaceId, provider, model });
    if (effort !== null) {
      await state.setChatModel({ chatId, provider, model, effort });
    }
    useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId } });
    await useAppStore.getState().sendChatMessage({ chatId, content: text });
  } catch (error) {
    void useAppStore
      .getState()
      .reportError({ title: "Couldn't start the chat", error, workspaceId });
  }
};
