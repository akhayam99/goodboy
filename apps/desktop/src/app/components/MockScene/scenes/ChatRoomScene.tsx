import { useEffect, useState } from 'react';
import type { ChatId } from '@goodboy/types';
import { ChatStudio } from '../../../../features/workspace-chat/components/ChatStudio';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { StudioFrame as AppStudioFrame } from '../../StudioFrame';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { sceneParam } from './audit/sceneParams';
import { seedStudioChrome } from './shellChrome';
import { StudioFrame } from './StudioFrame';

const noop = () => undefined;

const CONSENT_CHAT_ID = `mock-chat-${WORKSPACE_ID}-consent` as ChatId;

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

const OPENCODE: ProviderDisplayInfo = {
  ...CLAUDE,
  id: 'opencode',
  binary: 'opencode',
  label: 'OpenCode',
  docsUrl: 'https://opencode.ai/docs',
};

const initialChatId = (): ChatId | null =>
  sceneParam({ key: 'chat' }) === 'new' ? null : CONSENT_CHAT_ID;

export const ChatRoomScene = () => {
  const [isReady, setIsReady] = useState(false);
  const chatId = useAppStore((state) =>
    state.appStudio?.kind === 'chat' ? state.appStudio.chatId : null,
  );

  useEffect(() => {
    seedBoardScene();
    seedStudioChrome();
    useAppStore.setState({ providers: [CLAUDE, OPENCODE] });
    useAppStore.getState().openStudio({ studio: { kind: 'chat', chatId: initialChatId() } });
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      target={null}
      main={
        <AppStudioFrame kind="chat" onClose={noop}>
          <ChatStudio workspaceId={WORKSPACE_ID} chatId={chatId} onClose={noop} />
        </AppStudioFrame>
      }
    />
  );
};
