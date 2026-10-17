import { useEffect } from 'react';
import { mockChatSessionId } from '../../../../../features/workspace-chat/mockChatSessions';
import { sessionPlace, useAppStore } from '../../../../../store';
import { WORKSPACE_ID } from '../BoardScene';
import { ChatRoomScene } from '../ChatRoomScene';
import { TopbarStatesScene } from '../u23/topbar/TopbarStatesScene';

const OPEN_DELAY_MS = 300;

const ChatOriginOverviewScene = () => {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      useAppStore.getState().navigate({
        to: sessionPlace({
          sessionId: mockChatSessionId({ workspaceId: WORKSPACE_ID, key: 'consent' }),
        }),
      });
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);
  return <ChatRoomScene />;
};

export const U25_F58_CHAT_SCENES = {
  'f58-chat-room': () => <TopbarStatesScene Inner={ChatRoomScene} providerCount={4} />,
  'f58-chat-1100': () => <TopbarStatesScene Inner={ChatRoomScene} providerCount={4} width={1100} />,
  'f58-chat-origin': ChatOriginOverviewScene,
};
