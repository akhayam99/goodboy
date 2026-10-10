import { useEffect, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { ChatStudio } from '../../../../../features/workspace-chat/components/ChatStudio';
import { mockChatSessions } from '../../../../../features/workspace-chat/mockChatSessions';
import type { ProviderDisplayInfo } from '../../../../../features/providers/providers';
import { useAppStore } from '../../../../../store';
import { shellArrangement } from '../../../../shellArrangement';
import { StudioFrame } from '../../../StudioFrame';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { CONSENT_CHAT_ID } from '../ChatRoomScene';
import { installChatWorkStubs } from '../chatWorkSceneStubs';
import { driveChatWork } from '../driveChatWork';
import { seedStudioChrome } from '../shellChrome';

const WINDOW_WIDTH_PX = 1440;

const noop = () => undefined;

const arrangement = shellArrangement({
  hasWorkspace: true,
  hasActiveSession: false,
  isSidebarCollapsed: false,
  mode: 'column',
});

const CLAUDE: ProviderDisplayInfo = {
  id: 'anthropic',
  binary: 'claude',
  capabilities: { models: [], supportsTools: true, supportsStream: true, supportsCheapModel: true },
  connection: 'connected',
  version: '1.0.0',
  identity: 'mock-team',
  label: 'Claude',
  error: null,
  docsUrl: 'https://docs.claude.com/en/docs/claude-code/overview',
};

const DrawerSplitChat = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const { navigate } = useAppStore.getState();
    seedBoardScene();
    seedStudioChrome();
    installChatWorkStubs();
    useAppStore.setState({ navigate });
    useAppStore.setState((state) => ({
      providers: [CLAUDE],
      sessions: [...state.sessions, ...mockChatSessions({ workspaceId: WORKSPACE_ID })],
    }));
    useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId: CONSENT_CHAT_ID } });
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }
    return driveChatWork({ stage: 'drawer' });
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <div
      data-testid="drawer-split-chat"
      className="[&_.w-screen]:w-full"
      style={{ width: WINDOW_WIDTH_PX }}
    >
      <AppShell
        leftHidden={arrangement.leftHidden}
        leftSidebarCollapsed={arrangement.leftSidebarCollapsed}
        leftSidebar={<div aria-hidden />}
        main={<div />}
        studioCoversLeft={false}
        studio={
          <StudioFrame kind="chat" placement="content" onClose={noop}>
            <ChatStudio workspaceId={WORKSPACE_ID} chatId={CONSENT_CHAT_ID} onClose={noop} />
          </StudioFrame>
        }
      />
    </div>
  );
};

export const U24_DRAWERS_CHAT_SCENES = {
  'drawer-split-chat': DrawerSplitChat,
};
