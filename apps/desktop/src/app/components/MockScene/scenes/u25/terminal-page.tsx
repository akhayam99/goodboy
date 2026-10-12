import { useEffect } from 'react';
import { activeChatBackend } from '../../../../../features/workspace-chat/activeChatBackend';
import { ChatStudio } from '../../../../../features/workspace-chat/components/ChatStudio';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { PageSheet } from '../PageSheet';
import { seedStudioChrome } from '../shellChrome';

const NOOP = () => undefined;

const ChatFirstRunScene = () => {
  useEffect(() => {
    const { navigate } = useAppStore.getState();
    seedBoardScene();
    seedStudioChrome();
    useAppStore.setState({ navigate });
    useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId: null } });
    const clearChats = async (): Promise<void> => {
      const all = await activeChatBackend.listChats({
        workspaceId: WORKSPACE_ID,
        includeArchived: true,
      });
      if (all.length > 0) {
        await activeChatBackend.deleteChats({ chatIds: all.map((chat) => chat.id) });
      }
      await useAppStore.getState().loadChats({ workspaceId: WORKSPACE_ID });
      await useAppStore.getState().loadArchivedChats({ workspaceId: WORKSPACE_ID });
    };
    void clearChats();
  }, []);

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <ChatStudio workspaceId={WORKSPACE_ID} chatId={null} onClose={NOOP} />
      </PageSheet>
    </main>
  );
};

export const U25_TERMINAL_PAGE_SCENES = {
  'chat-first-run': ChatFirstRunScene,
};
