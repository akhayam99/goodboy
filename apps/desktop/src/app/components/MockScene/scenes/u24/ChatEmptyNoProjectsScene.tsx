import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { ChatRoomScene } from '../ChatRoomScene';

export const ChatEmptyNoProjectsScene = () => {
  useEffect(() => {
    useAppStore.setState({ projects: [] });
  }, []);
  return <ChatRoomScene chat="new" />;
};
