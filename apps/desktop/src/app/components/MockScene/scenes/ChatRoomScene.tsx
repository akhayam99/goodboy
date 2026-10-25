import { useEffect, useState } from 'react';
import type { ChatId, ChatMessageId, ProviderRunId } from '@goodboy/types';
import { mockChatSessions } from '../backends/chat/mockChatSessions';
import { ChatStudio } from '../../../../features/workspace-chat/components/ChatStudio';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../../features/onboarding/openCommandPaletteEvent';
import { PaletteOverlay } from '../../../../features/palette/components/PaletteOverlay';
import type { ProviderDisplayInfo } from '../../../../features/providers/providers';
import { useAppStore } from '../../../../store';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { StudioFrame as AppStudioFrame } from '../../StudioFrame';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { sceneParam } from './audit/sceneParams';
import { installChatWorkStubs } from './chatWorkSceneStubs';
import { driveChatWork, isChatWorkStage } from './driveChatWork';
import { ShellFrame, seedStudioChrome } from './shellChrome';
import { StudioFrame } from './StudioFrame';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';

const noop = () => undefined;

export const CONSENT_CHAT_ID = `mock-chat-${WORKSPACE_ID}-consent` as ChatId;

const CLAUDE: ProviderDisplayInfo = {
  id: 'anthropic',
  binary: 'claude',
  capabilities: { models: [] },
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

const chatIdOf = (key: string): ChatId => `mock-chat-${WORKSPACE_ID}-${key}` as ChatId;

type ChatKeyParams = {
  readonly key: string | null;
};

const initialChatId = ({ key }: ChatKeyParams): ChatId | null => {
  if (key === 'new') {
    return null;
  }
  return key === null ? CONSENT_CHAT_ID : chatIdOf(key);
};

type ChatSceneActivity = 'running' | 'unread' | 'mixed';

type ActivityParams = {
  readonly activity: string | null;
};

const seedChatActivity = ({ activity }: ActivityParams): void => {
  if (activity === 'running' || activity === 'mixed') {
    useAppStore.setState({
      chatStreams: {
        [chatIdOf('release')]: {
          runId: 'mock-run-release' as ProviderRunId,
          messageId: 'mock-message-release' as ChatMessageId,
          isStopping: false,
        },
      },
    });
  }
  if (activity === 'unread' || activity === 'mixed') {
    useAppStore.setState({ unreadChatIds: [chatIdOf('changes'), chatIdOf('rounding')] });
  }
};

type Props = {
  readonly chat?: string;
  readonly activity?: ChatSceneActivity;
};

export const ChatRoomScene = ({ chat, activity }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState<string | null>(() => sceneParam({ key: 'ask' }));
  const chatId = useAppStore((state) =>
    state.appStudio?.kind === 'chat' ? state.appStudio.chatId : null,
  );
  const isChatOpen = useAppStore((state) => state.appStudio?.kind === 'chat');
  const openSession = useAppStore((state) =>
    state.currentSessionId === null
      ? null
      : (sessionById(state.sessions, state.currentSessionId) ?? null),
  );

  useEffect(() => {
    const { navigate } = useAppStore.getState();
    seedBoardScene();
    seedStudioChrome();
    installChatWorkStubs();
    useAppStore.setState({ navigate });
    useAppStore.setState((state) => ({
      providers: [CLAUDE, OPENCODE],
      sessions: [...state.sessions, ...mockChatSessions({ workspaceId: WORKSPACE_ID })],
      projects: state.projects.map((project) => ({
        ...project,
        rootPath: project.rootPath.replace(/^~/, '/mock'),
      })),
    }));
    seedChatActivity({ activity: activity ?? sceneParam({ key: 'activity' }) });
    useAppStore.getState().openStudio({
      studio: {
        kind: 'chat',
        chatId: initialChatId({ key: chat ?? sceneParam({ key: 'chat' }) }),
      },
    });
    setIsReady(true);
  }, [chat, activity]);

  useEffect(() => {
    const stage = sceneParam({ key: 'work' });
    if (!isReady || !isChatWorkStage(stage)) {
      return undefined;
    }
    return driveChatWork({ stage });
  }, [isReady]);

  useEffect(() => {
    const open = () => setPaletteQuery('');
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, open);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, open);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <>
      {!isChatOpen && openSession !== null ? (
        <div data-scene-view="session" className="contents">
          <ShellFrame session={openSession} main={<SessionOverviewPane session={openSession} />} />
        </div>
      ) : (
        <div data-scene-view="chat" className="contents">
          <StudioFrame
            target={{ place: null, tool: null }}
            columnPlace="chat"
            main={
              <AppStudioFrame kind="chat" onClose={noop} placement="content">
                <ChatStudio workspaceId={WORKSPACE_ID} chatId={chatId} onClose={noop} />
              </AppStudioFrame>
            }
          />
        </div>
      )}
      {paletteQuery === null ? null : (
        <PaletteOverlay initialQuery={paletteQuery} onClose={() => setPaletteQuery(null)} />
      )}
    </>
  );
};
